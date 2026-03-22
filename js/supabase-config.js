// js/supabase-config.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://zoehaglpxcxnmnvrbvih.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_v0KFQEnhc8RxBWWPuMNm1g_DWqCxpto';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
