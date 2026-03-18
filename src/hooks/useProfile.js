import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

export function useProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }

    getProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setProfile(null); setLoading(false); return }
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => { setProfile(data); setLoading(false) })
    })

    return () => subscription.unsubscribe()
  }, [])

  return { profile, loading }
}
