import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as not requiring a JWT — health checks, login, reference data. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
