import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/auth-server'

// GET /api/plans — public plans visible on web (for pricing page)
export async function GET() {
  try {
    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_plans')
      .select('id, name, display_name, description, billing_cycles, permissions, is_active, visible_on_web, sort_order, comparison_text, target_role')
      .eq('is_active', true)
      .eq('visible_on_web', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[/api/plans]', err)
    return NextResponse.json([], { status: 500 })
  }
}
