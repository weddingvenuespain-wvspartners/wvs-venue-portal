import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/auth-server'
import { requireFeature } from '@/lib/plan-server'

// POST /api/estructura/commercial-configs/:id/duplicate
// Duplicates the config + all its modalities, packages, and prices

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const gate = await requireFeature('estructura')
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const svc = getServiceClient()

    // 1. Get original config
    const { data: original, error: origErr } = await svc
      .from('venue_commercial_configs')
      .select('*')
      .eq('id', id)
      .eq('user_id', gate.userId)
      .single()

    if (origErr || !original) return NextResponse.json({ error: 'Config no encontrada' }, { status: 404 })

    // 2. Create new config (copy)
    const newName = body.name?.trim() || `${original.name} (copia)`
    const { data: newConfig, error: cfgErr } = await svc
      .from('venue_commercial_configs')
      .insert({
        user_id: gate.userId,
        venue_id: original.venue_id,
        name: newName,
        config: original.config,                // copies zones/supplements/space_groups inside JSON
        config_type: original.config_type ?? 'space',
        is_default: false,
        sort_order: original.sort_order + 1,
      })
      .select()
      .single()

    if (cfgErr || !newConfig) {
      console.error('[duplicate config]', cfgErr?.message)
      return NextResponse.json({ error: cfgErr?.message ?? 'Error al duplicar' }, { status: 500 })
    }

    // 3. Get all modalities linked to original config
    const { data: modalities } = await svc
      .from('venue_modalities')
      .select(`
        *,
        packages:venue_modality_packages(
          *,
          prices:venue_modality_prices(*)
        ),
        prices:venue_modality_prices(*)
      `)
      .eq('user_id', gate.userId)
      .eq('commercial_config_id', id)
      .order('sort_order')

    if (!modalities || modalities.length === 0) {
      return NextResponse.json({ config: newConfig, modalities_copied: 0 })
    }

    // 4. Duplicate each modality with its packages and prices
    let modalitiesCopied = 0
    for (const mod of modalities) {
      // Create modality copy
      const { data: newMod, error: modErr } = await svc
        .from('venue_modalities')
        .insert({
          user_id: gate.userId,
          venue_id: mod.venue_id,
          commercial_config_id: newConfig.id,
          name: mod.name,
          description: mod.description,
          duration_label: mod.duration_label,
          duration_type: mod.duration_type,
          day_from: mod.day_from,
          day_to: mod.day_to,
          sort_order: mod.sort_order,
          is_active: mod.is_active,
        })
        .select()
        .single()

      if (modErr || !newMod) {
        console.error('[duplicate modality]', modErr?.message)
        continue
      }

      // Duplicate direct prices (non-package)
      const directPrices = (mod.prices ?? []).filter((p: any) => !p.package_id)
      for (const price of directPrices) {
        await svc.from('venue_modality_prices').insert({
          modality_id: newMod.id,
          user_id: gate.userId,
          date_from: price.date_from,
          date_to: price.date_to,
          price: price.price,
          price_per_person: price.price_per_person,
          price_tiers: price.price_tiers,
          zone_prices: price.zone_prices,
          zone_tier_prices: price.zone_tier_prices,
          supplement_prices: price.supplement_prices,
          group_prices: price.group_prices,
          group_tier_prices: price.group_tier_prices,
          space_supplements: price.space_supplements,
          notes: price.notes,
        })
      }

      // Duplicate packages + their prices
      for (const pkg of (mod.packages ?? [])) {
        const { data: newPkg } = await svc
          .from('venue_modality_packages')
          .insert({
            modality_id: newMod.id,
            day_from: pkg.day_from,
            day_to: pkg.day_to,
            label: pkg.label,
            sort_order: pkg.sort_order,
          })
          .select()
          .single()

        if (!newPkg) continue

        for (const price of (pkg.prices ?? [])) {
          await svc.from('venue_modality_prices').insert({
            modality_id: newMod.id,
            package_id: newPkg.id,
            user_id: gate.userId,
            date_from: price.date_from,
            date_to: price.date_to,
            price: price.price,
            price_per_person: price.price_per_person,
            price_tiers: price.price_tiers,
            zone_prices: price.zone_prices,
            zone_tier_prices: price.zone_tier_prices,
            supplement_prices: price.supplement_prices,
            group_prices: price.group_prices,
            group_tier_prices: price.group_tier_prices,
            space_supplements: price.space_supplements,
            notes: price.notes,
          })
        }
      }

      modalitiesCopied++
    }

    return NextResponse.json({ config: newConfig, modalities_copied: modalitiesCopied })
  } catch (err: any) {
    console.error('[commercial-configs/:id/duplicate]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
