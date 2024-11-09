import { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase';
import { doc, updateDoc, onSnapshot, increment, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import NavigationMap from '../components/NavigationMap';

export default function EvacueeDashboard() {
  const [location, setLocation] = useState(null);
  const [needsHelp, setNeedsHelp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [requestStatus, setRequestStatus] = useState({
    isLoading: false,
    error: null,
    success: false
  });
  const [status, setStatus] = useState('safe');
  const [assignedVolunteer, setAssignedVolunteer] = useState(null);
  const [helpCategory, setHelpCategory] = useState('medical');
  const [peopleCount, setPeopleCount] = useState(1);
  const [additionalDetails, setAdditionalDetails] = useState('');

  // Listen to user's status changes
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'users', auth.currentUser.uid),
      (doc) => {
        const data = doc.data();
        if (data) {
          setNeedsHelp(data.needsHelp || false);
          setStatus(data.status || 'safe');
          setAssignedVolunteer(data.assignedVolunteer || null);
          if (data.location) {
            setLocation(data.location);
          }
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const updateRequestStatus = (isLoading, error = null, success = false) => {
    setRequestStatus({ isLoading, error, success });
  };

  const requestHelp = async () => {
    updateRequestStatus(true);
    try {
      if (!navigator.geolocation) {
        updateRequestStatus(false, 'Geolocation is not supported by your browser');
        toast.error('Geolocation is not supported by your browser');
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

      if (position.coords.accuracy > 150) {
        updateRequestStatus(false, 'Location accuracy is too low. Please try moving to an open area or turning on Wi-Fi for better accuracy.');
        toast.error('Location accuracy is too low. Please try moving to an open area or turning on Wi-Fi for better accuracy.');
        return;
      }

      const newLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: new Date().toISOString(),
        accuracy: position.coords.accuracy
      };

      setLocation(newLocation);
      
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        location: newLocation,
        needsHelp: true,
        requestTimestamp: new Date().toISOString(),
        status: 'waiting_for_help',
        helpCategory: helpCategory,
        peopleCount: peopleCount,
        additionalDetails: additionalDetails
      });

      setNeedsHelp(true);
      updateRequestStatus(false, null, true);
      toast.success('Help request sent! Volunteers will be notified.');
    } catch (error) {
      updateRequestStatus(false, error.message);
      toast.error(error.message);
    }
  };

  const cancelHelpRequest = async () => {
    try {
      setNeedsHelp(false);
      updateRequestStatus(false, null, false);

      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        needsHelp: false,
        status: 'request_canceled'
      });

      toast.success('Help request canceled.');
    } catch (error) {
      console.error('Error canceling help request:', error);
      toast.error('Failed to cancel help request.');
    }
  };

  const getAccuracyColor = (accuracy) => {
    if (accuracy <= 50) return 'text-green-600';
    if (accuracy <= 100) return 'text-yellow-600';
    return 'text-red-600';
  };

  const VolunteerInfo = ({ volunteer }) => (
    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h3 className="font-medium text-blue-800 mb-2">Help is on the way!</h3>
      <div className="space-y-2 text-blue-700">
        <p>Volunteer: {volunteer.email}</p>
        {volunteer.location && (
          <div className="space-y-4">
            <div className="bg-white p-3 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2">Current Location</h4>
              <p>Distance: {calculateDistance(location, volunteer.location)} km away</p>
              <p className="text-sm text-gray-600">
                Accuracy: ±{Math.round(volunteer.location.accuracy)}m
              </p>
            </div>
            
            <div className="mt-4 h-64 rounded-lg overflow-hidden">
              <NavigationMap
                origin={volunteer.location}
                destination={location}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );



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

  const markAsHelped = async (evacueeId) => {
    try {
      const evacueeRef = doc(db, 'users', evacueeId);
      const evacueeDoc = await getDoc(evacueeRef);
      const evacueeData = evacueeDoc.data();

      // Check if the current user is the assigned volunteer
      if (evacueeData.assignedVolunteer.id !== auth.currentUser.uid) {
        toast.error('You are not assigned to this evacuee.');
        return;
      }

      // Update evacuee's document
      await updateDoc(evacueeRef, {
        status: 'helped',
        assignedVolunteer: null
      });

      // Update volunteer's document
      const volunteerRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(volunteerRef, {
        currentlyHelping: null
      });

      toast.success('Evacuee marked as helped.');
    } catch (error) {
      console.error('Error marking evacuee as helped:', error);
      toast.error('Failed to mark evacuee as helped.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Evacuee Dashboard</h1>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Your Status</h2>
            <div className={`p-3 rounded-lg ${
              needsHelp ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
            }`}>
              {needsHelp ? 'Help request is active, Authorities have been notified aswell' : 'You are marked as safe'}
            </div>
          </div>

          {needsHelp ? (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center mb-2">
                  <svg className="h-6 w-6 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-lg font-semibold text-red-700">Help Request Active</span>
                </div>
                <p className="text-red-600">Emergency services and volunteers have been notified and are reviewing your request.</p>
              </div>
              <button
                onClick={cancelHelpRequest}
                disabled={requestStatus.isLoading}
                className={`w-full py-3 px-4 rounded-lg font-medium
                  ${requestStatus.isLoading 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  } transition-colors`}
              >
                {requestStatus.isLoading ? 'Processing...' : 'Cancel Help Request'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Request Emergency Help</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Type of Help Needed</label>
                    <select
                      value={helpCategory}
                      onChange={(e) => setHelpCategory(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                      <option value="medical">🚑 Medical Emergency</option>
                      <option value="evacuation">🚗 Evacuation</option>
                      <option value="supplies">🥫 Food/Water Supplies</option>
                      <option value="shelter">🏠 Shelter</option>
                      <option value="other">❗ Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Number of People</label>
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() => setPeopleCount(Math.max(1, peopleCount - 1))}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={peopleCount}
                        onChange={(e) => setPeopleCount(Math.max(1, parseInt(e.target.value)))}
                        className="w-20 text-center px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setPeopleCount(peopleCount + 1)}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Additional Details</label>
                    <textarea
                      value={additionalDetails}
                      onChange={(e) => setAdditionalDetails(e.target.value)}
                      placeholder="Please provide any important details that could help the volunteers (medical conditions, specific needs, landmarks near you, etc.)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg h-32 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={requestHelp}
                      disabled={requestStatus.isLoading}
                      className={`w-full py-6 px-6 rounded-lg text-xl font-semibold
                        ${requestStatus.isLoading 
                          ? 'bg-gray-300 cursor-not-allowed' 
                          : 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white shadow-lg hover:shadow-xl'
                        } transform transition-all duration-200 hover:-translate-y-0.5`}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <span>{requestStatus.isLoading ? 'Processing...' : 'Request Emergency Help'}</span>
                      </div>
                    </button>
                    
                    {requestStatus.error && (
                      <div className="mt-3 text-red-500 text-sm">
                        {requestStatus.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <svg className="h-5 w-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-blue-800">Important Note</span>
                </div>
                <p className="text-sm text-blue-600">
                  Only use this service for genuine emergencies. Emergency services and volunteers will be notified immediately upon your request.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {location && (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="font-medium text-gray-800 mb-2">Your Location</h3>
            <div className="space-y-2 text-gray-600">
              <p>Latitude: {location.lat}</p>
              <p>Longitude: {location.lng}</p>
              <p className="text-sm">
                Last updated: {new Date(location.timestamp).toLocaleString()}
              </p>
              {location.accuracy && (
                <p className={`text-sm ${getAccuracyColor(location.accuracy)}`}>
                  Accuracy: ±{Math.round(location.accuracy)}m
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}