import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Service-role client for Storage operations (bypasses RLS)
function getStorageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const BUCKET = 'venue-images'

export async function POST(req: NextRequest) {
  try {
    // 1. Verify the user is authenticated
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Parse the file
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido. Usa JPG, PNG, WEBP o GIF.' }, { status: 400 })
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo es demasiado grande. Máximo 20 MB.' }, { status: 400 })
    }

    // Verify magic bytes to prevent spoofed MIME types
    const magicMap: Record<string, number[]> = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png':  [0x89, 0x50, 0x4E, 0x47],
      'image/webp': [0x52, 0x49, 0x46, 0x46],
      'image/gif':  [0x47, 0x49, 0x46, 0x38],
    }
    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    const expectedMagic = magicMap[file.type]
    if (!expectedMagic || !expectedMagic.every((b, i) => header[i] === b)) {
      return NextResponse.json({ error: 'El archivo no es una imagen válida.' }, { status: 400 })
    }

    // 3. Upload to Supabase Storage
    const svc = getStorageClient()
    const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'gif'
    const uid  = session.user.id.slice(0, 8)
    const ts   = Date.now()
    const rand = Math.random().toString(36).slice(2, 7)
    const path = `${uid}/${ts}-${rand}.${ext}`

    const fileBuffer = await file.arrayBuffer()

    // Ensure bucket exists (creates if missing, ignores if already exists)
    await svc.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 20971520 }).catch(() => {})

    const { error: uploadError } = await svc.storage
      .from(BUCKET)
      .upload(path, fileBuffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('[/api/upload] Storage error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // 4. Get public URL
    const { data: urlData } = svc.storage.from(BUCKET).getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    // Use timestamp as numeric ID (compatible with existing code expecting a number)
    const numericId = ts

    return NextResponse.json({
      success: true,
      id:        numericId,
      url:       publicUrl,
      thumbnail: publicUrl,
      full:      publicUrl,
    })

  } catch (err) {
    console.error('[/api/upload]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
