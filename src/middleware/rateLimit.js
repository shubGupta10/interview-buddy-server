import redis from '../redis/redis.js';

const WINDOW = 60; 
const MAX_REQUESTS = 10;

const rateLimit = async (req, res, next) => {
    const userId = req.headers["x-user-id"] || req.query.userId || req.body.userId;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    
    const key = userId ? `rate-limit-for-api:${userId}` : `rate-limit-for-api:${ip}`;

    const currentCount = await redis.get(key);

    if (currentCount && currentCount >= MAX_REQUESTS) {
        console.warn(`Rate limit exceeded for ${key}`);
        return res.status(429).json({ error: "Too many requests, slow down!" });
    }

    await redis.multi().incr(key).expire(key, WINDOW).exec();

    next();
};


export default rateLimit;
