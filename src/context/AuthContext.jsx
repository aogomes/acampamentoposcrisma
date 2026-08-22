import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [pessoaProfile, setPessoaProfile] = useState(null);

  const fetchProfile = async (userId) => {
    try {
      // Fetch Perfil
      const { data: perfilData, error: perfilError } = await supabase
        .from('apc_perfil')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (perfilError && (perfilError.message.includes('JWT') || perfilError.code === 'PGRST301')) {
        await supabase.auth.signOut();
        return;
      }
        
      setUserProfile(perfilData || null);

      // Fetch Pessoa
      const { data: pessoaData } = await supabase
        .from('apc_pessoa')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      setPessoaProfile(pessoaData || null);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setUserProfile(null);
      setPessoaProfile(null);
    }
  };

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setUserProfile(null);
        setPessoaProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    signUp: (data) => supabase.auth.signUp(data),
    signIn: (data) => supabase.auth.signInWithPassword(data),
    signOut: () => supabase.auth.signOut(),
    user,
    userProfile,
    pessoaProfile,
    refreshProfile: () => user && fetchProfile(user.id),
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
