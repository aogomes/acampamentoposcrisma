import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [pessoaProfile, setPessoaProfile] = useState(null);

  const fetchProfile = async (userId, userEmail) => {
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
      let { data: pessoaData } = await supabase
        .from('apc_pessoa')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Se não encontrou apc_pessoa pelo user_id mas temos o e-mail, tenta auto-vincular
      if (!pessoaData && userEmail) {
        try {
          const { data: pessoaByEmail } = await supabase
            .from('apc_pessoa')
            .select('*')
            .ilike('email', userEmail)
            .is('user_id', null)
            .maybeSingle();

          if (pessoaByEmail) {
            await supabase.from('apc_pessoa').update({ user_id: userId }).eq('id', pessoaByEmail.id);
            pessoaData = { ...pessoaByEmail, user_id: userId };
          }
        } catch (linkErr) {
          console.warn('Auto-vinculo de pessoa por email ignorado:', linkErr);
        }
      }

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
        await fetchProfile(session.user.id, session.user.email);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email);
      } else {
        setUserProfile(null);
        setPessoaProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
  };

  const value = {
    signUp: (data) => supabase.auth.signUp(data),
    signIn: (data) => supabase.auth.signInWithPassword(data),
    signInWithGoogle,
    signOut: () => supabase.auth.signOut(),
    user,
    userProfile,
    pessoaProfile,
    refreshProfile: () => user && fetchProfile(user.id, user.email),
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
