import { FormSchema } from './schema';

export const validFormSchema: FormSchema = {
  schema_version: 1,
  title: 'Community feedback',
  description: 'Tell us how we can improve.',
  default_locale: 'en',
  enabled_locales: ['en', 'ml'],
  sections: [
    {
      id: 'sec_main',
      title: 'Feedback',
      fields: [
        { id: 'fld_name', type: 'short_text', label: 'Your name', required: false },
        {
          id: 'fld_rating',
          type: 'rating',
          label: 'How would you rate us?',
          required: true,
          validation: { min: 1, max: 5 },
        },
        {
          id: 'fld_topic',
          type: 'single_choice',
          label: 'What is your topic?',
          options: [
            { id: 'opt_service', label: 'Service' },
            { id: 'opt_support', label: 'Support' },
          ],
        },
        {
          id: 'fld_details',
          type: 'long_text',
          label: 'Tell us more',
          condition: { field_id: 'fld_topic', operator: 'equals', value: 'opt_service' },
          validation: { max_length: 2_000 },
        },
      ],
    },
  ],
};
