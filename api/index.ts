import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'

// 1. Tell Vercel to use Edge Runtime (Fixes the crash)
export const config = {
  runtime: 'edge',
}

const app = new Hono().basePath('/api')

app.use('/*', cors())

const searchSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  limit: z.coerce.number().min(1).max(100).default(10)
})

app.get('/search/songs', async (c) => {
  try {
    const query = c.req.query()
    const parsed = searchSchema.safeParse(query)
    
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0].message }, 400)
    }

    const { q, limit } = parsed.data

    const gaanaUrl = `https://gaana.com/apiv2?country=IN&startIndex=0&secType=track&type=search&keyword=${encodeURIComponent(q)}`
    
    // 2. Added User-Agent so Gaana doesn't block Vercel IPs
    const response = await fetch(gaanaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Gaana API error: ${response.status}`)
    }
    
    const data = await response.json()
    const tracks = data.tracks && Array.isArray(data.tracks) ? data.tracks.slice(0, limit) : []

    return c.json({ success: true, data: tracks })

  } catch (error) {
    console.error('API Error:', error)
    return c.json({ success: false, error: 'Internal Server Error' }, 500)
  }
})

// 3. Export the app directly (No handle wrapper needed for Edge)
export default app
