import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseDataService } from '../supabase/supabase-data.service';

export const creatorGuard: CanActivateFn = async (_route, state) => {
  const data = inject(SupabaseDataService);
  const router = inject(Router);
  const user = await data.currentUser();

  return user
    ? true
    : router.createUrlTree(['/auth'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = async () => {
  const data = inject(SupabaseDataService);
  const router = inject(Router);
  const user = await data.currentUser();

  return user ? router.createUrlTree(['/forms']) : true;
};

/** The marketing home is public, but signed-in creators have a useful workspace home. */
export const publicHomeGuard: CanActivateFn = async () => {
  const data = inject(SupabaseDataService);
  const router = inject(Router);
  const user = await data.currentUser();

  return user ? router.createUrlTree(['/forms']) : true;
};
