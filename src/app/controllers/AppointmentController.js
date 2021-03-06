import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format } from 'date-fns';

import Appointment from '../models/Appointment';
import User from '../models/User';
import File from '../models/File';
import Notification from '../schemas/Notification';

import Queue from '../../lib/Queue';
import CancelationMail from '../jobs/CancelationMail';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      order: ['date'],
      attributes: ['id', 'date', 'past', 'cancelable'],
      limit: 20,
      offset: (page - 1) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['path', 'url'],
            },
          ],
        },
      ],
    });

    return res.json(appointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const { provider_id, date } = req.body;

    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider || provider_id === req.userId) {
      return res.status(401).json({ error: 'Invalid provider informed' });
    }

    const hourStart = startOfHour(parseISO(date));

    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ error: 'Past date' });
    }

    const isUnavailableDate = await Appointment.findOne({
      where: { provider_id, canceled_at: null, date: hourStart },
    });

    if (isUnavailableDate) {
      return res.status(400).json({ error: 'Time slot not available' });
    }

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date,
    });

    // Add notification to provider
    const { name } = await User.findByPk(req.userId);
    const formattedDate = format(hourStart, 'MMMM dd, h:mma');

    await Notification.create({
      content: `New appointment scheduled to ${name} at ${formattedDate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { model: User, as: 'provider', attributes: ['name', 'email'] },
        { model: User, as: 'user', attributes: ['name'] },
      ],
    });

    if (appointment.user_id !== req.userId) {
      return res
        .status(401)
        .json({ error: 'Invalid permission for this appointment' });
    }

    if (appointment.canceled_at !== null) {
      return res
        .status(401)
        .json({ error: 'This appointment is already canceled' });
    }

    if (!appointment.cancelable) {
      return res.status(401).json({
        error: "You can't cancel an appointment within less than 2 hours",
      });
    }

    appointment.canceled_at = new Date();

    await appointment.save();

    await Queue.add(CancelationMail.key, { appointment });

    return res.json(appointment);
  }
}

export default new AppointmentController();
