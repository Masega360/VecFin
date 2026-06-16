-- ============================================================================
-- SEED COMPLETO DE VECFIN
-- Ejecutar después de docker-compose up (migraciones ya aplicadas):
--   Get-Content seed.sql | docker exec -i vecfin_db psql -U vecfin -d vecfin
-- Login: user1@vecfin.com a user50@vecfin.com / password123!
-- ============================================================================

-- ─── 1. USUARIOS (50) ────────────────────────────────────────────────────────
DO $$
DECLARE
  platform_custom UUID;
  uids UUID[] := ARRAY[]::UUID[];
  wids UUID[] := ARRAY[]::UUID[];
  uid UUID;
  wid UUID;
  i INT;
  j INT;
  tickers TEXT[] := ARRAY['BTC-USD','ETH-USD','SOL-USD','ADA-USD','DOGE-USD','XRP-USD','DOT-USD','AVAX-USD','MATIC-USD','LINK-USD','AAPL','MSFT','NVDA','TSLA','AMZN','GOOG','META','NFLX','AMD','INTC'];
BEGIN
  SELECT id INTO platform_custom FROM platform WHERE name = 'custom' LIMIT 1;

  FOR i IN 1..50 LOOP
    INSERT INTO users (id, first_name, last_name, email, password_hash, risk_type)
    VALUES (
      gen_random_uuid(),
      (ARRAY['Juan','Maria','Carlos','Ana','Lucas','Sofia','Mateo','Valentina','Santiago','Camila','Diego','Martina','Nicolas','Isabella','Tomas','Lucia','Benjamin','Emma','Gabriel','Mia','Agustin','Delfina','Lautaro','Catalina','Facundo','Olivia','Thiago','Alma','Maximo','Renata','Joaquin','Julieta','Bautista','Elena','Ignacio','Antonella','Felipe','Emilia','Sebastian','Victoria','Ezequiel','Florencia','Samuel','Clara','Leon','Milagros','Dante','Abril','Bruno','Rocio'])[i],
      (ARRAY['Perez','Garcia','Lopez','Martinez','Fernandez','Rodriguez','Gomez','Diaz','Torres','Ramirez','Sanchez','Romero','Alvarez','Ruiz','Ortiz','Gutierrez','Moreno','Munoz','Jimenez','Vargas','Castro','Flores','Herrera','Medina','Acosta','Suarez','Reyes','Cruz','Ramos','Molina','Navarro','Mendoza','Castillo','Rios','Campos','Vega','Delgado','Fuentes','Carrillo','Rojas','Sosa','Nunez','Miranda','Silva','Cordoba','Ponce','Aguilar','Vera','Cardozo','Luna'])[i],
      'user' || i || '@vecfin.com',
      '$2a$10$o251pN17B5OHgrWCqReBFefobh.BlJghu8WBnWcGHpcWHxlCknKzC',
      (ARRAY['conservative','moderate','aggressive'])[((i-1) % 3) + 1]
    ) ON CONFLICT (email) DO NOTHING;

    SELECT id INTO uid FROM users WHERE email = 'user' || i || '@vecfin.com';
    uids := array_append(uids, uid);
  END LOOP;

-- ─── 2. WALLETS (80) + MEMBERS + ASSETS ──────────────────────────────────────

  FOR i IN 1..80 LOOP
    INSERT INTO wallet (id, creator_id, platform_id, name) VALUES (
      gen_random_uuid(),
      uids[((i - 1) % 50) + 1],
      platform_custom,
      (ARRAY['Portfolio Principal','Ahorros Crypto','Trading Diario','Hold Largo Plazo','Fondo Grupal','DCA Bitcoin','Altcoins Mix','Acciones Tech','Staking','Yield Farming','NFT Fund','Reserva','Emergencia','Jubilacion Crypto','Especulacion','Blue Chips','Small Caps','DeFi','Gaming Tokens','Metaverso'])[((i - 1) % 20) + 1] || ' #' || i
    );
  END LOOP;

  FOR wid IN SELECT id FROM wallet ORDER BY created_at DESC LIMIT 80 LOOP
    wids := array_append(wids, wid);
  END LOOP;

  FOR i IN 1..80 LOOP
    INSERT INTO wallet_member (wallet_id, user_id, role)
    VALUES (wids[i], uids[((i - 1) % 50) + 1], 'owner')
    ON CONFLICT DO NOTHING;
    FOR j IN 1..3 LOOP
      INSERT INTO wallet_member (wallet_id, user_id, role)
      VALUES (wids[i], uids[((i + j * 7) % 50) + 1], (ARRAY['admin','viewer','viewer'])[j])
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  FOR i IN 1..80 LOOP
    FOR j IN 1..4 LOOP
      INSERT INTO asset_wallet (wallet_id, ticker, quantity) VALUES (
        wids[i], tickers[((i + j * 3) % 20) + 1], round((random() * 1000 + 0.1)::numeric, 4)
      ) ON CONFLICT (wallet_id, ticker) DO NOTHING;
    END LOOP;
  END LOOP;

-- ─── 3. TRANSFERENCIAS (30) ──────────────────────────────────────────────────

  FOR i IN 1..30 LOOP
    INSERT INTO transfer (from_wallet_id, to_wallet_id, ticker, quantity, note, created_by) VALUES (
      wids[((i * 2) % 80) + 1], wids[((i * 3 + 5) % 80) + 1],
      tickers[((i) % 20) + 1], round((random() * 10 + 0.01)::numeric, 4),
      (ARRAY['Aporte mensual','Split de ganancias','Rebalanceo','Pago','Prestamo','Dividendos',NULL,NULL,NULL,NULL])[((i - 1) % 10) + 1],
      uids[((i) % 50) + 1]
    );
  END LOOP;

-- ─── 4. COMUNIDADES (8) + MIEMBROS ──────────────────────────────────────────

  DECLARE cid UUID;
  BEGIN
    FOR i IN 1..8 LOOP
      INSERT INTO communities (id, creator_id, name, description, rules, topics, is_private, logo_url)
      VALUES (
        gen_random_uuid(), uids[i],
        (ARRAY['Crypto Argentina','DeFi Traders','Hodlers Club','Tech Stocks Latam','Trading para Novatos','Inversiones a Largo Plazo','Altcoins & Gems','Analisis Tecnico'])[i],
        (ARRAY['Comunidad para inversores cripto argentinos','Estrategias de DeFi y yield farming','Buy and hold, sin vender nunca','Acciones tech para inversores latinos','Aprende a tradear desde cero','Estrategias conservadoras de largo plazo','Descubri las proximas altcoins x100','Analisis de charts y patrones'])[i],
        'Respetar a los demas. No spam. No financial advice.',
        (ARRAY['{"crypto","argentina"}','{"defi","yield"}','{"bitcoin","hodl"}','{"stocks","tech"}','{"trading","education"}','{"investing","longterm"}','{"altcoins","research"}','{"analysis","charts"}'])[i]::text[],
        i > 6, ''
      ) RETURNING id INTO cid;

      INSERT INTO community_members (community_id, user_id, role) VALUES (cid, uids[i], 'owner') ON CONFLICT DO NOTHING;
      FOR j IN 1..8 LOOP
        INSERT INTO community_members (community_id, user_id, role)
        VALUES (cid, uids[((i + j * 5) % 50) + 1], (ARRAY['member','member','member','moderator'])[((j-1) % 4) + 1])
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END;

-- ─── 5. POSTS (14) ──────────────────────────────────────────────────────────

  DECLARE c1 UUID; c2 UUID; c3 UUID; c4 UUID;
  BEGIN
    SELECT id INTO c1 FROM communities WHERE name='Crypto Argentina';
    SELECT id INTO c2 FROM communities WHERE name='DeFi Traders';
    SELECT id INTO c3 FROM communities WHERE name='Hodlers Club';
    SELECT id INTO c4 FROM communities WHERE name='Tech Stocks Latam';

    INSERT INTO posts (community_id, author_id, title, content) VALUES
      (c1, uids[1], 'Bitcoin a 100k este mes?', 'Alguien mas piensa que BTC rompe los 100k antes de fin de mes? Los indicadores estan todos bullish'),
      (c1, uids[2], 'Mejor exchange para argentinos', 'Que exchange usan para comprar crypto con pesos? Binance P2P? Lemon? Fiwind?'),
      (c1, uids[3], 'Tutorial: DCA automatico', 'Les comparto mi estrategia de DCA semanal en BTC y ETH. Vengo haciendo esto hace 2 anios'),
      (c1, uids[4], 'Ojo con las regulaciones', 'Se viene regulacion cripto en Argentina. Estan preparados?'),
      (c1, uids[5], 'Solana vs Ethereum en 2026', 'SOL esta volando, va a superar a ETH en TVL?'),
      (c2, uids[1], 'Yield farming en Aave v3', 'Estoy sacando 8% APY en USDC en Aave. Alguien tiene mejores estrategias?'),
      (c2, uids[2], 'Riesgo de impermanent loss', 'Cuidado con los pools de LP en Uniswap, el IL me comio las ganancias de 3 meses'),
      (c2, uids[3], 'Mejores vaults 2026', 'Yearn, Beefy o Convex? Cual les esta dando mas rendimiento este anio?'),
      (c3, uids[1], 'Mi portfolio hold desde 2020', 'BTC, ETH y SOL. No vendi nada en todo el bear market. Hoy estoy 400% arriba'),
      (c3, uids[3], 'Nunca vender es la clave', 'El que vendio en el crash de 2022 se arrepiente hoy. Diamond hands forever'),
      (c3, uids[5], 'Cuando tomar profit?', 'Se que somos holders pero... en algun punto hay que realizar ganancias no?'),
      (c4, uids[1], 'NVDA despues del split', 'Nvidia sigue siendo buy despues del stock split? Analicemos'),
      (c4, uids[2], 'Apple vs Microsoft 2026', 'Cual tiene mejor upside para los proximos 5 anios?'),
      (c4, uids[4], 'AMD la proxima NVDA?', 'AMD esta infravalorada comparada con NVDA. Es momento de entrar?');
  END;

  -- Actualizar contadores
  UPDATE communities SET member_count = (SELECT count(*) FROM community_members cm WHERE cm.community_id = communities.id);
  UPDATE communities SET post_count = (SELECT count(*) FROM posts p WHERE p.community_id = communities.id);

  RAISE NOTICE 'SEED COMPLETO: 50 users, 80 wallets, ~320 assets, 30 transfers, 8 comunidades, 14 posts';
END $$;

-- ─── 6. MARKETPLACE POOL ────────────────────────────────────────────────────
INSERT INTO market_pool (ticker, quantity) VALUES
  ('BTC-USD', 50), ('ETH-USD', 500), ('SOL-USD', 10000), ('ADA-USD', 100000),
  ('DOGE-USD', 500000), ('XRP-USD', 50000), ('DOT-USD', 20000), ('AVAX-USD', 5000),
  ('MATIC-USD', 80000), ('LINK-USD', 15000), ('AAPL', 200), ('MSFT', 150),
  ('NVDA', 100), ('TSLA', 300), ('AMZN', 80), ('GOOG', 60), ('META', 120), ('USDT', 1000000)
ON CONFLICT (ticker) DO UPDATE SET quantity = market_pool.quantity + EXCLUDED.quantity;
