import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'
import { z } from 'zod'

// 1. MUST BE EDGE: This prevents the Vercel Invocation Crash!
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
    
    // Sometimes Gaana blocks Vercel. Adding extra headers helps bypass this.
    const response = await fetch(gaanaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://gaana.com/'
      }
    })

    // Read the response as text first, so if Gaana blocks us we can see the HTML error page
    const responseText = await response.text()

    if (!response.ok) {
      return c.json({ 
        success: false, 
        error: `Gaana blocked the request with Status ${response.status}`,
        details: responseText.substring(0, 300) // Show why they blocked it
      }, response.status)
    }
    
    try {
      const data = JSON.parse(responseText)
      const tracks = data.tracks && Array.isArray(data.tracks) ? data.tracks.slice(0, limit) : []
      return c.json({ success: true, data: tracks })
    } catch (parseError) {
      return c.json({ 
        success: false, 
        error: 'Gaana did not return valid JSON',
        details: responseText.substring(0, 300)
      }, 500)
    }

  } catch (error: any) {
    // THIS WILL FINALLY SHOW US THE HIDDEN ERROR!
    return c.json({ 
      success: false, 
      error: error.message || 'Network Fetch Error'
    }, 500)
  }
})

// 2. MUST BE HANDLED: Required for Hono on Vercel
export default handle(app)
