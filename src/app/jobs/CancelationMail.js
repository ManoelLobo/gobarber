import { format, parseISO } from 'date-fns';

import Mail from '../../lib/Mail';

class CancelationMail {
  get key() {
    return 'CancelationMail';
  }

  async handle({ data }) {
    const { appointment } = data;

    await Mail.sendMail({
      to: `${appointment.provider.name} <${appointment.provider.email}>`,
      subject: 'Appointment canceled',
      template: 'cancelation',
      context: {
        provider: appointment.provider.name,
        user: appointment.provider.name,
        date: format(parseISO(appointment.date), 'MMMM dd, h:mma'),
      },
    });
  }
}

export default new CancelationMail();
