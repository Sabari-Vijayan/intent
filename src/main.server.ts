import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { provideSupabase } from './app/core/supabase/supabase.provider';
import { environment } from './environments/environment';

export const appConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideSupabase(environment.supabase),
  ],
};

export default () => bootstrapApplication(AppComponent, appConfig);