-- Seed masivo: 50 usuarios, 80 wallets, muchos assets y membresías
-- Password para todos: "password123"
-- Ejecutar: docker exec -i vecfin_db psql -U vecfin -d vecfin < backend/seed.sql

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

  -- 50 usuarios
  FOR i IN 1..50 LOOP
    INSERT INTO users (id, first_name, last_name, email, password_hash)
    VALUES (
      gen_random_uuid(),
      (ARRAY['Juan','María','Carlos','Ana','Lucas','Sofía','Mateo','Valentina','Santiago','Camila','Diego','Martina','Nicolás','Isabella','Tomás','Lucía','Benjamín','Emma','Gabriel','Mía','Agustín','Delfina','Lautaro','Catalina','Facundo','Olivia','Thiago','Alma','Máximo','Renata','Joaquín','Julieta','Bautista','Elena','Ignacio','Antonella','Felipe','Emilia','Sebastián','Victoria','Ezequiel','Florencia','Samuel','Clara','León','Milagros','Dante','Abril','Bruno','Rocío'])[i],
      (ARRAY['Pérez','García','López','Martínez','Fernández','Rodríguez','Gómez','Díaz','Torres','Ramírez','Sánchez','Romero','Álvarez','Ruiz','Ortiz','Gutiérrez','Moreno','Muñoz','Jiménez','Vargas','Castro','Flores','Herrera','Medina','Acosta','Suárez','Reyes','Cruz','Ramos','Molina','Navarro','Mendoza','Castillo','Ríos','Campos','Vega','Delgado','Fuentes','Carrillo','Rojas','Sosa','Núñez','Miranda','Silva','Córdoba','Ponce','Aguilar','Vera','Cardozo','Luna'])[i],
      'user' || i || '@vecfin.com',
      '$2a$10$L16uhkq.CN89adsOq3zAwuKTNgmJcSjsk4VHC27K2sPvFNyBLvKES'
    ) ON CONFLICT (email) DO NOTHING;

    SELECT id INTO uid FROM users WHERE email = 'user' || i || '@vecfin.com';
    uids := array_append(uids, uid);
  END LOOP;

  -- 80 wallets (algunos users tienen varias)
  FOR i IN 1..80 LOOP
    INSERT INTO wallet (id, creator_id, platform_id, name) VALUES (
      gen_random_uuid(),
      uids[((i - 1) % 50) + 1],
      platform_custom,
      (ARRAY['Portfolio Principal','Ahorros Crypto','Trading Diario','Hold Largo Plazo','Fondo Grupal','DCA Bitcoin','Altcoins Mix','Acciones Tech','Staking','Yield Farming','NFT Fund','Reserva','Emergencia','Jubilación Crypto','Especulación','Blue Chips','Small Caps','DeFi','Gaming Tokens','Metaverso'])[((i - 1) % 20) + 1] || ' #' || i
    );
  END LOOP;

  -- Recolectar wallet IDs
  FOR wid IN SELECT id FROM wallet ORDER BY created_at DESC LIMIT 80 LOOP
    wids := array_append(wids, wid);
  END LOOP;

  -- wallet_member: owners + colaboradores random
  FOR i IN 1..80 LOOP
    -- Owner
    INSERT INTO wallet_member (wallet_id, user_id, role)
    VALUES (wids[i], uids[((i - 1) % 50) + 1], 'owner')
    ON CONFLICT DO NOTHING;

    -- 2-4 miembros extra por wallet
    FOR j IN 1..3 LOOP
      INSERT INTO wallet_member (wallet_id, user_id, role)
      VALUES (
        wids[i],
        uids[((i + j * 7) % 50) + 1],
        (ARRAY['admin','viewer','viewer'])[j]
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Assets: 3-5 tickers por wallet
  FOR i IN 1..80 LOOP
    FOR j IN 1..4 LOOP
      INSERT INTO asset_wallet (wallet_id, ticker, quantity) VALUES (
        wids[i],
        tickers[((i + j * 3) % 20) + 1],
        round((random() * 1000 + 0.1)::numeric, 4)
      ) ON CONFLICT (wallet_id, ticker) DO NOTHING;
    END LOOP;
  END LOOP;

  -- Transferencias de ejemplo
  FOR i IN 1..30 LOOP
    INSERT INTO transfer (from_wallet_id, to_wallet_id, ticker, quantity, note, created_by) VALUES (
      wids[((i * 2) % 80) + 1],
      wids[((i * 3 + 5) % 80) + 1],
      tickers[((i) % 20) + 1],
      round((random() * 10 + 0.01)::numeric, 4),
      (ARRAY['Aporte mensual','Split de ganancias','Rebalanceo','Pago','Préstamo','Dividendos',NULL,NULL,NULL,NULL])[((i - 1) % 10) + 1],
      uids[((i) % 50) + 1]
    );
  END LOOP;

  RAISE NOTICE 'Seed masivo completado: 50 usuarios, 80 wallets, ~320 assets, ~240 membresías, 30 transferencias';
END $$;


-- Seed del marketplace pool
INSERT INTO market_pool (ticker, quantity) VALUES
  ('BTC-USD', 50),
  ('ETH-USD', 500),
  ('SOL-USD', 10000),
  ('ADA-USD', 100000),
  ('DOGE-USD', 500000),
  ('XRP-USD', 50000),
  ('DOT-USD', 20000),
  ('AVAX-USD', 5000),
  ('MATIC-USD', 80000),
  ('LINK-USD', 15000),
  ('AAPL', 200),
  ('MSFT', 150),
  ('NVDA', 100),
  ('TSLA', 300),
  ('AMZN', 80),
  ('GOOG', 60),
  ('META', 120),
  ('USDT', 1000000)
ON CONFLICT (ticker) DO UPDATE SET quantity = market_pool.quantity + EXCLUDED.quantity;
