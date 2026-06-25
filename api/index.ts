import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'
import { z } from 'zod'

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

    // FIX 1: Added usrLang back (Required by Gaana to not throw 404)
    // We set it to English,Hindi,Bhojpuri to get accurate, unbiased top results
    const gaanaUrl = `https://gaana.com/apiv2?country=IN&startIndex=0&secType=track&usrLang=English,Hindi,Bhojpuri&type=search&keyword=${encodeURIComponent(q)}`
    
    // FIX 2: Enhanced Headers so Gaana thinks this is a real user browser, not Vercel
    const response = await fetch(gaanaUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://gaana.com/',
        'Origin': 'https://gaana.com',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      }
    })

    const responseText = await response.text()

    if (!response.ok) {
      return c.json({ 
        success: false, 
        error: `Gaana blocked the request with Status ${response.status}`,
        details: responseText.substring(0, 300) 
      }, response.status)
    }
    
    try {
      const data = JSON.parse(responseText)
      // Safely extract tracks
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
    return c.json({ 
      success: false, 
      error: error.message || 'Network Fetch Error'
    }, 500)
  }
})

export default handle(app)
