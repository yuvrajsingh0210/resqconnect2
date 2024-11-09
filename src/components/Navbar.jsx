import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../config/firebase';
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function Navbar() {
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const [totalHelped, setTotalHelped] = useState(0);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (!currentUser || userRole !== 'volunteer') return;

    const unsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), (doc) => {
      const data = doc.data();
      const totalHelpedValue = data?.totalHelped;

      // Validate and sanitize totalHelped
      if (typeof totalHelpedValue === 'number' && totalHelpedValue >= 0) {
        setTotalHelped(totalHelpedValue);
      } else {
        console.warn('Invalid totalHelped value:', totalHelpedValue);
        setTotalHelped(0); // Default to 0 if invalid
      }
    });

    return () => unsubscribe();
  }, [currentUser, userRole]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-gray-800 dark:text-white">
              Disaster Relief
            </Link>
          </div>
          
          <div className="flex items-center">
            {currentUser ? (
              <>
                <Link
                  to={userRole === 'volunteer' ? '/volunteer-dashboard' : '/evacuee-dashboard'}
                  className="text-gray-700 hover:text-blue-500 px-3 py-2"
                >
                  Dashboard
                </Link>
                {userRole === 'volunteer' && (
                  <span className="text-gray-600 px-3 py-2">
                    Total Helped: {totalHelped}
                  </span>
                )}
                <button
                  onClick={async () => {
                    try {
                      await auth.signOut();
                      navigate('/login');
                    } catch (error) {
                      console.error('Logout error:', error);
                    }
                  }}
                  className="ml-4 text-gray-700 hover:text-blue-500 px-3 py-2"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-blue-500 px-3 py-2"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="ml-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 