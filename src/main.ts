import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { provideSupabase } from './app/core/supabase/supabase.provider';
import { environment } from './environments/environment';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(),
    provideSupabase(environment.supabase),
  ],
}).catch((err) => console.error(err));