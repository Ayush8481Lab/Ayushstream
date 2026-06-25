import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'
import { z } from 'zod'

const app = new Hono().basePath('/api')

// Enable CORS
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
    
    const response = await fetch(gaanaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    })

    // 1. Read as text first so it doesn't crash if Gaana returns an HTML error page
    const responseText = await response.text()

    if (!response.ok) {
      return c.json({ 
        success: false, 
        error: `Gaana API returned Status ${response.status}`,
        details: responseText.substring(0, 200) // Show a snippet of what Gaana responded with
      }, 500)
    }
    
    // 2. Safely parse the JSON
    const data = JSON.parse(responseText)
    const tracks = data.tracks && Array.isArray(data.tracks) ? data.tracks.slice(0, limit) : []

    return c.json({ success: true, data: tracks })

  } catch (error: any) {
    // 3. THIS WILL NOW SHOW US THE EXACT ERROR!
    return c.json({ 
      success: false, 
      error: error.message || 'An unknown error occurred'
    }, 500)
  }
})

export default handle(app)
