import { ValueTransformer } from 'typeorm';

/**
 * pg `numeric` columns come back as strings via node-postgres.  This keeps them
 * as JS numbers so the matching engine's arithmetic stays correct.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) =>
    value === null || value === undefined ? value : value,
  from: (value: string | null) =>
    value === null || value === undefined ? value : parseFloat(value),
};
