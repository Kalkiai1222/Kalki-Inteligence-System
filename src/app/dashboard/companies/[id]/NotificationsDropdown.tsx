import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationsDropdownProps {
  companyId: string;
}

export function NotificationsDropdown({ companyId }: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const loadNotifications = async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/notifications`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (companyId) loadNotifications();
    // Setting up polling for real-time vibe (every 30s)
    const interval = setInterval(() => {
      if (companyId) loadNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [companyId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length === 0) return;

    try {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))); // Optimistic UI mapping
      await fetch(`/api/companies/${companyId}/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: unreadIds })
      });
    } catch (error) {
      console.error('Failed to mark read', error);
      loadNotifications(); // Revert on failure
    }
  };

  const handleToggle = () => {
    if (!isOpen) { // When opening, mark read immediately
      markAllAsRead();
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleToggle} 
        className="relative h-11 w-11 flex items-center justify-center text-gray-500 hover:text-indigo-600 transition-colors focus:outline-none bg-white border rounded-full shadow-sm"
        aria-label="Open notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-600 text-white text-xs font-bold text-center leading-5 ring-2 ring-white translate-x-1 -translate-y-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden transform opacity-100 scale-100 transition-all origin-top-right">
          <div className="px-4 py-3 bg-gray-50 border-b flex justify-between items-center text-sm font-semibold text-gray-700">
            <h3>Notifications</h3>
            {notifications.length > 0 && <span className="text-xs font-normal text-gray-500">{notifications.length} recent</span>}
          </div>
          <div className="max-h-96 overflow-y-auto w-full">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 flex flex-col items-center">
                 <Bell className="w-8 h-8 text-gray-300 mb-2" />
                 No new notifications.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map(notification => (
                  <li key={notification.id} className={`p-4 hover:bg-gray-50 transition-colors ${!notification.isRead ? 'bg-blue-50/50' : 'bg-white'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-bold text-gray-900">{notification.title}</h4>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{notification.message}</p>
                    {notification.link && (
                      <a href={notification.link} className="inline-block mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded">
                        View Details &rarr;
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}