const Session = require('../../../../db/models/sessionModel');

const timeAgo = (date) => {
  const diff = (new Date() - new Date(date)) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
};

exports.getLoginActivity = async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user._id });

    const result = sessions.map((s) => ({
      sessionId: s._id,
      location: s.location,
      device: s.device,
      lastActive: timeAgo(s.lastActive),
      current: s.token === req.token, // ✅ will work if req.token is correctly set
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching login activity:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.logoutSession = async (req, res) => {
  const { sessionId } = req.body;

  try {
    const session = await Session.findOne({ _id: sessionId, userId: req.user._id });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    await Session.deleteOne({ _id: sessionId });

    res.json({ success: true, message: 'Session logged out successfully' });
  } catch (err) {
    console.error('Error logging out session:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
