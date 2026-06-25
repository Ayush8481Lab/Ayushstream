import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'
import { z } from 'zod'

const app = new Hono().basePath('/api')

// Enable CORS so frontend apps can call your API
app.use('/*', cors())

// Validation Schema (z.coerce automatically converts "?limit=10" string to a number)
const searchSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  limit: z.coerce.number().min(1).max(100).default(10)
})

app.get('/search/songs', async (c) => {
  try {
    // 1. Validate Input
    const query = c.req.query()
    const parsed = searchSchema.safeParse(query)
    
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0].message }, 400)
    }

    const { q, limit } = parsed.data

    // 2. Fetch ONLY tracks from Gaana (Removed the Bhojpuri/startIndex bias)
    const gaanaUrl = `https://gaana.com/apiv2?country=IN&startIndex=0&secType=track&type=search&keyword=${encodeURIComponent(q)}`
    
    const response = await fetch(gaanaUrl)
    if (!response.ok) throw new Error('Gaana API responded with an error')
    
    const data = await response.json()

    // 3. Format Response (Extracting tracks array, handling empty cases)
    const tracks = data.tracks && Array.isArray(data.tracks) ? data.tracks.slice(0, limit) : []

    return c.json({
      success: true,
      data: tracks
    })

  } catch (error) {
    console.error(error)
    return c.json({ success: false, error: 'Internal Server Error' }, 500)
  }
})

// Export for Vercel Serverless Function
export default handle(app)
