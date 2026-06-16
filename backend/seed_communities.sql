-- Seed de comunidades
DO $$
DECLARE
  uids UUID[];
  cid UUID;
  i INT;
  j INT;
BEGIN
  SELECT array_agg(id ORDER BY email) INTO uids FROM users WHERE email LIKE 'user%@vecfin.com';

  -- Crear 8 comunidades
  FOR i IN 1..8 LOOP
    INSERT INTO communities (id, creator_id, name, description, rules, topics, is_private)
    VALUES (
      gen_random_uuid(),
      uids[i],
      (ARRAY['Crypto Argentina 🇦🇷','DeFi Traders','Hodlers Club','Tech Stocks Latam','Trading para Novatos','Inversiones a Largo Plazo','Altcoins & Gems','Análisis Técnico'])[i],
      (ARRAY['Comunidad para inversores cripto argentinos','Estrategias de DeFi y yield farming','Buy and hold, sin vender nunca','Acciones tech para inversores latinos','Aprendé a tradear desde cero','Estrategias conservadoras de largo plazo','Descubrí las próximas altcoins x100','Análisis de charts y patrones'])[i],
      'Respetar a los demás. No spam. No financial advice.',
      (ARRAY['{"crypto","argentina"}','{"defi","yield"}','{"bitcoin","hodl"}','{"stocks","tech"}','{"trading","education"}','{"investing","longterm"}','{"altcoins","research"}','{"analysis","charts"}'])[i]::text[],
      i > 6
    ) RETURNING id INTO cid;

    -- Creator como owner
    INSERT INTO community_members (community_id, user_id, role) VALUES (cid, uids[i], 'owner') ON CONFLICT DO NOTHING;

    -- Agregar 5-10 miembros random
    FOR j IN 1..8 LOOP
      INSERT INTO community_members (community_id, user_id, role)
      VALUES (cid, uids[((i + j * 5) % 50) + 1], (ARRAY['member','member','member','moderator'])[((j-1) % 4) + 1])
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seed comunidades: 8 comunidades con miembros creadas';
END $$;
