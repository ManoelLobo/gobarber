import Notification from '../schemas/Notification';
import User from '../models/User';

class NotificationController {
  async index(req, res) {
    const isUserProvider = await User.findOne({
      where: { id: req.userId, provider: true },
    });

    if (!isUserProvider) {
      return res.status(401).json({ error: 'User is not a provider' });
    }

    const notifications = await Notification.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(20);

    return res.json(notifications);
  }
}

export default new NotificationController();
