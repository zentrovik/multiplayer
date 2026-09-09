import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ''

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

if (!supabase) {
  console.warn('Supabase is not configured. Guest mode will remain available.')
}

export const RANK_TIERS = [
  { rank: 'E', minExp: 0, nextExp: 250 },
  { rank: 'D', minExp: 250, nextExp: 500 },
  { rank: 'C', minExp: 500, nextExp: 750 },
  { rank: 'B', minExp: 750, nextExp: 1000 },
  { rank: 'A', minExp: 1000, nextExp: 1500 },
  { rank: 'S', minExp: 1500, nextExp: 2000 },
  { rank: 'God Mode', minExp: 2000, nextExp: null },
]

export function calculateRankFromExp(exp = 0) {
  const currentExp = Number(exp) || 0
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (currentExp >= RANK_TIERS[i].minExp) {
      return RANK_TIERS[i].rank
    }
  }
  return 'E'
}

export async function getOrCreateProfile(user) {
  if (!supabase || !user || user.isGuest) return null

  const userId = String(user.uid || user.id)
  if (!userId) return null

  try {
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (fetchError) {
      console.error('Supabase profile fetch error:', fetchError.message)
    }

    if (existingProfile) {
      return existingProfile
    }

    const newProfile = {
      id: userId,
      username: user.displayName || 'Shadow Warrior',
      email: user.email || '',
      photo_url: user.photoURL || '',
      rank: 'E',
      exp: 0,
      gems: 100,
    }

    const { data: insertedProfile, error: insertError } = await supabase
      .from('profiles')
      .insert([newProfile])
      .select()
      .single()

    if (insertError) {
      console.error('Supabase profile creation error:', insertError.message)
      return newProfile
    }

    return insertedProfile
  } catch (err) {
    console.error('Unexpected error in getOrCreateProfile:', err)
    return null
  }
}

export async function getUserProfile(userId) {
  if (!supabase || !userId) return null

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', String(userId))
      .single()

    if (error) {
      console.error('Error fetching user profile:', error.message)
      return null
    }

    return data
  } catch (err) {
    console.error('Unexpected error in getUserProfile:', err)
    return null
  }
}

export async function updateProfileStats(userId, updates = {}) {
  if (!supabase || !userId) return null

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', String(userId))
      .select()
      .single()

    if (error) {
      console.error('Error updating profile stats:', error.message)
      return null
    }

    return data
  } catch (err) {
    console.error('Unexpected error in updateProfileStats:', err)
    return null
  }
}