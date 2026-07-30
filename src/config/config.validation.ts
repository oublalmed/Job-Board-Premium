import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production', 'staging')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  TZ: Joi.string().default('Africa/Casablanca'),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  // Storage
  STORAGE_ENDPOINT: Joi.string().uri().required(),
  STORAGE_ACCESS_KEY: Joi.string().required(),
  STORAGE_SECRET_KEY: Joi.string().required(),
  STORAGE_BUCKET: Joi.string().default('jobboard'),
  STORAGE_REGION: Joi.string().default('us-east-1'),
  STORAGE_FORCE_PATH_STYLE: Joi.boolean().default(true),

  // Business rules
  PROFILE_COMPLETENESS_THRESHOLD: Joi.number().min(0).max(100).default(70),
  INDEXATION_SCORE_THRESHOLD: Joi.number().min(0).max(100).default(40),
  INDEXATION_PERCENTILE_THRESHOLD: Joi.number().min(0).max(100).default(30),
  HIGHLIGHT_PERCENTILE_THRESHOLD: Joi.number().min(0).max(100).default(75),
  SCORE_VALIDITY_MONTHS: Joi.number().min(1).default(12),
  RETEST_COOLDOWN_DAYS: Joi.number().min(1).default(90),
  TRIAL_DURATION_DAYS: Joi.number().min(1).default(14),
  PASSWORD_MIN_LENGTH: Joi.number().min(8).default(10),
  MAX_CV_SIZE_BYTES: Joi.number().default(5242880),

  // Pricing
  PLAN_STARTER_PRICE: Joi.number().default(990),
  PLAN_STARTER_CONTACTS: Joi.number().default(15),
  PLAN_STARTER_OFFERS: Joi.number().default(1),
  PLAN_STARTER_USERS: Joi.number().default(1),
  PLAN_GROWTH_PRICE: Joi.number().default(2900),
  PLAN_GROWTH_CONTACTS: Joi.number().default(60),
  PLAN_GROWTH_OFFERS: Joi.number().default(5),
  PLAN_GROWTH_USERS: Joi.number().default(3),
  PLAN_SCALE_PRICE: Joi.number().default(6900),
  PLAN_SCALE_CONTACTS: Joi.number().default(200),
  PLAN_SCALE_OFFERS: Joi.number().default(20),
  PLAN_SCALE_USERS: Joi.number().default(10),
  CURRENCY: Joi.string().default('MAD'),

  // Scoring webhook
  SCORING_WEBHOOK_SECRET: Joi.string().allow('').default(''),

  // Payment (Stripe)
  STRIPE_SECRET_KEY: Joi.string().allow('').default(''),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow('').default(''),
});
