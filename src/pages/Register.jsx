import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { getCurrentLocation } from '../utils/location';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: ''
  });
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      setFormData({ ...formData, email: rememberedEmail });
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.role) {
      toast.error('Please select a role before registering.');
      return;
    }

    try {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      let userData = {
        email: formData.email,
        role: formData.role,
        points: 0,
        totalHelped: 0,
        createdAt: new Date().toISOString(),
        needsHelp: false,
        status: 'safe'
      };

      if (formData.role === 'volunteer') {
        try {
          const location = await getCurrentLocation();
          userData = {
            ...userData,
            lastKnownLocation: location,
            currentlyHelping: null
          };
        } catch (error) {
          console.error('Location error:', error);
          toast.error('Unable to get your location');
        }
      }

      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, userData);

      toast.success('Registration successful!');
      navigate(formData.role === 'volunteer' ? '/volunteer-dashboard' : '/evacuee-dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.message);
      
      if (auth.currentUser) {
        await auth.currentUser.delete();
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">Register</h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">Select Role</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'volunteer' })}
                  className={`p-4 rounded-lg border ${
                    formData.role === 'volunteer'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-300'
                  }`}
                >
                  Volunteer
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'evacuee' })}
                  className={`p-4 rounded-lg border ${
                    formData.role === 'evacuee'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-300'
                  }`}
                >
                  Need Evacuation
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
              />
              <label className="ml-2 text-gray-700">Remember Me</label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600"
          >
            Register
          </button>
        </form>
      </div>
    </div>
  );
}