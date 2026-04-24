import React from 'react';

const Profile = () => {
  const user = {
    username: 'JohnDoe',
    email: 'johndoe@example.com',
    joinedDate: '2024-01-01',
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar">{user.username.charAt(0).toUpperCase()}</div>
        <h2>{user.username}</h2>
        <p>{user.email}</p>
        <p>Member since {user.joinedDate}</p>
      </div>
    </div>
  );
};

export default Profile;