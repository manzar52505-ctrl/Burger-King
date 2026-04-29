import pg from 'pg';
const { Pool } = pg;

/**
 * PostgreSQL Connection Pool
 * Using lazy initialization to prevent crashes if credentials aren't provided immediately
 */
let pool: pg.Pool | null = null;

export const getPool = () => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    const host = process.env.POSTGRES_HOST;
    
    const isInvalidHost = (h: string | undefined) => 
      !h || 
      h === 'base' || 
      h === 'localhost' || 
      h === '0.0.0.0' ||
      h.includes('your-') || 
      h.includes('placeholder');
      
    const isInvalidUrl = (url: string | undefined) => 
      !url || 
      url.includes('base') || 
      url.includes('placeholder') || 
      url.includes('your-');

    // Check if we have valid credentials. If not, don't even try to connect.
    const hasValidConfig = (!isInvalidUrl(connectionString)) || (!isInvalidHost(host));
    if (!hasValidConfig) {
      return null;
    }

    pool = new Pool({
      connectionString: connectionString,
      user: process.env.POSTGRES_USER,
      host: host,
      database: process.env.POSTGRES_DB,
      password: process.env.POSTGRES_PASSWORD,
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }
  return pool;
};

/**
 * Query helper with graceful degradation
 */
export const query = async (text: string, params?: any[]) => {
  const p = getPool();
  if (!p) {
    throw new Error('Database not configured');
  }
  return p.query(text, params);
};
