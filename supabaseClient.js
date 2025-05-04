const dotenv = require('dotenv');
dotenv.config()
// supabaseClient.js
const { createClient } = require('@supabase/supabase-js');

// Substitua essas variáveis pelas suas credenciais do Supabase
const SUPABASE_URL = process.env.SUPABASE_URL; // Sua URL do Supabase
const SUPABASE_KEY = process.env.SUPABASE_KEY; // Sua chave de API (ou chave pública)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;
