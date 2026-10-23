import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InjectionToken } from '@angular/core';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export const SUPABASE_CONFIG = new InjectionToken<SupabaseConfig>('SUPABASE_CONFIG');
export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT');

export function provideSupabase(config: SupabaseConfig) {
  return [
    { provide: SUPABASE_CONFIG, useValue: config },
    {
      provide: SUPABASE_CLIENT,
      useFactory: (cfg: SupabaseConfig) => createClient(cfg.url, cfg.anonKey),
      deps: [SUPABASE_CONFIG],
    },
  ];
}