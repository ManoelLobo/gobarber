import { startOfDay, endOfDay, parseISO } from 'date-fns';
import { Op } from 'sequelize';

import User from '../models/User';
import Appointment from '../models/Appointment';

class CalendarController {
  async index(req, res) {
    const isUserProvider = await User.findOne({
      where: { id: req.userId, provider: true },
    });

    if (!isUserProvider) {
      return res.status(401).json({ error: 'User is not a provider' });
    }

    const parsedDate = parseISO(req.query.date);

    const appointments = await Appointment.findAll({
      where: {
        provider_id: req.userId,
        canceled_at: null,
        date: { [Op.between]: [startOfDay(parsedDate), endOfDay(parsedDate)] },
      },
      order: ['date'],
    });

    return res.json(appointments);
  }
}

export default new CalendarController();
