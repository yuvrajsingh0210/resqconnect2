import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import toast from 'react-hot-toast';
import NavigationMap from '../components/NavigationMap';
import SuccessModal from '../components/SuccessModal';
import { getCurrentLocation } from '../utils/location';

export default function VolunteerDashboard() {
  const [evacuees, setEvacuees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvacuee, setSelectedEvacuee] = useState(null);
  const [volunteerLocation, setVolunteerLocation] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [helpedEvacueeEmail, setHelpedEvacueeEmail] = useState('');
  const { currentUser } = useAuth();

  // Get volunteer's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setVolunteerLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Unable to get your location');
        }
      );
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const evacueeQuery = query(
      collection(db, 'users'),
      where('needsHelp', '==', true),
      where('status', '==', 'waiting_for_help')
    );

    const unsubscribe = onSnapshot(evacueeQuery, (snapshot) => {
      const evacueeData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          location: data.location || null,
          timeSinceRequest: formatTimeSince(data.requestTimestamp)
        };
      });
      console.log('Processed evacuee data:', evacueeData);
      setEvacuees(evacueeData);
      setLoading(false);
    }, (error) => {
      console.error("Error in snapshot listener:", error);
      toast.error("Failed to load help requests");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const volunteerRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(volunteerRef, async (docSnapshot) => {
      const data = docSnapshot.data();
      if (data?.currentlyHelping) {
        // Fetch evacuee details
        const evacueeRef = doc(db, 'users', data.currentlyHelping);
        const evacueeDoc = await getDoc(evacueeRef);
        if (evacueeDoc.exists()) {
          const evacueeData = evacueeDoc.data();
          setSelectedEvacuee({
            id: evacueeDoc.id,
            ...evacueeData,
            location: evacueeData.location || null,
            timeSinceRequest: formatTimeSince(evacueeData.requestTimestamp)
          });
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !selectedEvacuee) return;

    const evacueeRef = doc(db, 'users', selectedEvacuee.id);
    const unsubscribe = onSnapshot(evacueeRef, (docSnapshot) => {
      const data = docSnapshot.data();
      if (data?.status === 'safe' && data?.lastHelpedBy?.id === currentUser.uid) {
        setHelpedEvacueeEmail(data.email);
        setShowSuccessModal(true);
        setSelectedEvacuee(null);
      }
    });

    return () => unsubscribe();
  }, [currentUser, selectedEvacuee]);

  const handleOfferHelp = async (evacueeId) => {
    try {
      const evacuee = evacuees.find(e => e.id === evacueeId);
      setSelectedEvacuee(evacuee);
      const volunteerRef = doc(db, 'users', currentUser.uid);
      const volunteerDoc = await getDoc(volunteerRef);
      const volunteerData = volunteerDoc.data();

      // Get current location and update stored location
      let currentLocation;
      try {
        currentLocation = await getCurrentLocation();
      } catch (locationError) {
        console.error('Error getting current location:', locationError);
        toast.error('Unable to get your current location. Please try again.');
        return;
      }

      // Update evacuee's document with volunteer info
      const evacueeRef = doc(db, 'users', evacueeId);
      await updateDoc(evacueeRef, {
        status: 'help_coming',
        assignedVolunteer: {
          id: currentUser.uid,
          email: volunteerData.email,
          location: currentLocation,
          lastKnownLocation: volunteerData.lastKnownLocation,
          assignedAt: new Date().toISOString()
        }
      });

      // Update volunteer's document
      await updateDoc(volunteerRef, {
        currentlyHelping: evacueeId,
        status: 'helping',
        location: currentLocation,
        lastKnownLocation: currentLocation
      });

      toast.success('Help offer sent to evacuee');
    } catch (error) {
      console.error('Error offering help:', error);
      toast.error('Failed to send help offer');
    }
  };

  const formatTimeSince = (timestamp) => {
    if (!timestamp) return 'unknown time ago';
    
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ' years ago';
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' days ago';
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ' hours ago';
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ' minutes ago';
    
    return Math.floor(seconds) + ' seconds ago';
  };

  const calculateDistance = (point1, point2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lng - point1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header showing selected evacuee */}
      {selectedEvacuee && (
        <div className="bg-white shadow-md p-4 mb-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Currently Helping
                </h2>
                <p className="text-gray-600">
                  Request received: {selectedEvacuee.timeSinceRequest}
                </p>
              </div>
              {selectedEvacuee.location && volunteerLocation && (
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    Distance: {calculateDistance(volunteerLocation, selectedEvacuee.location)} km away
                  </p>
                  <p className="text-sm text-gray-500">
                    Location accuracy: ±{Math.round(selectedEvacuee.location.accuracy)}m
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex">
        {/* Left side - Evacuee list */}
        <div className="w-1/2 p-6 overflow-y-auto">
          <h1 className="text-2xl font-bold mb-4 text-gray-800">Active Requests</h1>
          
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-pulse text-gray-600">Loading requests...</div>
            </div>
          ) : evacuees.length === 0 ? (
            <div className="bg-white p-6 rounded-lg shadow-sm text-center">
              <p className="text-gray-600">No active help requests</p>
              <p className="text-sm text-gray-500 mt-2">Check back later for new requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {evacuees.map(evacuee => (
                <div 
                  key={evacuee.id} 
                  className={`bg-white p-4 rounded-lg shadow-sm border-2 transition-all duration-200 border-transparent hover:border-blue-200`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">Help Request</h3>
                      <span className="inline-block px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 mt-1">
                        {evacuee.timeSinceRequest}
                      </span>
                    </div>
                    {evacuee.location?.accuracy && (
                      <span className="text-xs text-gray-500">
                        ±{Math.round(evacuee.location.accuracy)}m
                      </span>
                    )}
                  </div>

                  <div className="mb-3 space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-600">Type:</span>
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        {evacuee.helpCategory || 'Not specified'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-600">People:</span>
                      <span className="px-2 py-1   text-xs rounded-full bg-purple-100 text-purple-800">
                        {evacuee.peopleCount || 1} {evacuee.peopleCount === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                  </div>

                  {evacuee.additionalDetails && (
                    <div className="mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-600">Details:</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                        {evacuee.additionalDetails}
                      </p>
                    </div>
                  )}

                  {evacuee.location ? (
                    <div className="space-y-1 text-sm text-gray-600 mb-3">
                      <div className="grid grid-cols-2 gap-1">
                        <span>Latitude:</span>
                        <span className="font-mono">{evacuee.location.lat?.toFixed(6)}</span>
                        <span>Longitude:</span>
                        <span className="font-mono">{evacuee.location.lng?.toFixed(6)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Updated: {evacuee.location.timestamp ? new Date(evacuee.location.timestamp).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-red-600 mb-3">Location unavailable</p>
                  )}

                  <button
                    onClick={() => handleOfferHelp(evacuee.id)}
                    className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors text-sm font-medium"
                  >
                    Offer Help
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right side - Map */}
        <div className="w-1/2 p-6">
          {volunteerLocation && (
            <NavigationMap
              origin={volunteerLocation}
              destination={selectedEvacuee?.status === 'help_coming' || selectedEvacuee?.status === 'waiting_for_help' ? selectedEvacuee.location : null}
            />
          )}
        </div>
      </div>

      <SuccessModal 
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        evacueeEmail={helpedEvacueeEmail}
      />
    </div>
  );
}