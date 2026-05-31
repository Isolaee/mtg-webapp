-- Minimal e2e seed for the TCG Builder backend.
-- Generated from the card DB schema; checked in so CI needs no tracked DB blob.
-- The backend auto-creates the other tables (collection, card_hashes, rb_*,
-- tournaments, auth_tokens, …) and ALTERs decks/users on startup.

-- MTG cards (assumed pre-existing by the backend; not auto-created).
CREATE TABLE cards (
    name TEXT PRIMARY KEY,          -- Card name as the primary key
    manacost TEXT,                  -- Mana cost of the card
    cmc INTEGER,                    -- Converted mana cost
    colors TEXT,                    -- Colors (stored as a JSON string or comma-separated values)
    coloridentity TEXT,             -- Color identity (stored as a JSON string or comma-separated values)
    power INTEGER,                  -- Power
    toughness INTEGER,              -- Toughness
    oracletext TEXT,                -- Oracle text
    loyalty INTEGER,                -- Loyalty (for planeswalkers)
    supertype TEXT,                 -- Supertype (from regex group)
    cardtype TEXT,                  -- Card type (SecondaryType + PrimaryType)
    typeline TEXT,                  -- Type line (from regex group creatureType, can be empty)
    artist TEXT,                    -- Artist of the card
    legalities TEXT,                -- Legalities (stored as JSON or text)
    image TEXT                      -- URL to the card image
);

-- Users (register/login). created_at/is_premium have defaults.
CREATE TABLE users (
	id INTEGER NOT NULL, 
	username VARCHAR(80) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, created_at TEXT DEFAULT (datetime('now')), is_premium INTEGER NOT NULL DEFAULT 0, 
	PRIMARY KEY (id), 
	UNIQUE (username)
);

-- MTG decks base table. The backend adds sideboard/maybeboard/is_public/
-- share_slug via ALTER TABLE on startup.
CREATE TABLE decks (
	id INTEGER NOT NULL, 
	name VARCHAR NOT NULL, 
	description VARCHAR, 
	format VARCHAR NOT NULL, 
	commander JSON, 
	cards JSON, user_id TEXT, 
	PRIMARY KEY (id)
);

-- A few stable cards for the search specs.
INSERT OR IGNORE INTO cards (name,manacost,cmc,colors,coloridentity,power,toughness,oracletext,loyalty,supertype,cardtype,typeline,artist,legalities,image) VALUES ('Lightning Bolt','{R}',1,'["R"]','["R"]',NULL,NULL,'Lightning Bolt deals 3 damage to any target.',NULL,'','Instant','','Christopher Rush','{"standard": "not_legal", "future": "not_legal", "historic": "banned", "timeless": "legal", "gladiator": "legal", "pioneer": "not_legal", "explorer": "not_legal", "modern": "legal", "legacy": "legal", "pauper": "legal", "vintage": "legal", "penny": "not_legal", "commander": "legal", "oathbreaker": "legal", "standardbrawl": "not_legal", "brawl": "legal", "alchemy": "not_legal", "paupercommander": "legal", "duel": "legal", "oldschool": "not_legal", "premodern": "legal", "predh": "legal"}','https://cards.scryfall.io/normal/front/0/2/0277c0b1-da97-49c1-a539-7fbaa1f77419.jpg?1741205837');
INSERT OR IGNORE INTO cards (name,manacost,cmc,colors,coloridentity,power,toughness,oracletext,loyalty,supertype,cardtype,typeline,artist,legalities,image) VALUES ('Sol Ring','{1}',1,'[]','[]',NULL,NULL,'{T}: Add {C}{C}.',NULL,'','Artifact','','Kekai Kotaki','{"standard": "not_legal", "future": "not_legal", "historic": "not_legal", "timeless": "not_legal", "gladiator": "not_legal", "pioneer": "not_legal", "explorer": "not_legal", "modern": "not_legal", "legacy": "banned", "pauper": "not_legal", "vintage": "restricted", "penny": "not_legal", "commander": "legal", "oathbreaker": "banned", "standardbrawl": "not_legal", "brawl": "not_legal", "alchemy": "not_legal", "paupercommander": "not_legal", "duel": "banned", "oldschool": "not_legal", "premodern": "not_legal", "predh": "legal"}','https://cards.scryfall.io/normal/front/0/6/06be8262-4636-4a2c-a0c8-de741cf45aed.jpg?1696638321');
INSERT OR IGNORE INTO cards (name,manacost,cmc,colors,coloridentity,power,toughness,oracletext,loyalty,supertype,cardtype,typeline,artist,legalities,image) VALUES ('Counterspell','{U}{U}',2,'["U"]','["U"]',NULL,NULL,'Counter target spell.',NULL,'','Instant','','Zack Stella','{"standard": "not_legal", "future": "not_legal", "historic": "banned", "timeless": "legal", "gladiator": "legal", "pioneer": "not_legal", "explorer": "not_legal", "modern": "legal", "legacy": "legal", "pauper": "legal", "vintage": "legal", "penny": "not_legal", "commander": "legal", "oathbreaker": "legal", "standardbrawl": "not_legal", "brawl": "legal", "alchemy": "not_legal", "paupercommander": "legal", "duel": "legal", "oldschool": "not_legal", "premodern": "legal", "predh": "legal"}','https://cards.scryfall.io/normal/front/0/2/02da8709-4228-4fed-9d2d-781e686661df.jpg?1675199223');
INSERT OR IGNORE INTO cards (name,manacost,cmc,colors,coloridentity,power,toughness,oracletext,loyalty,supertype,cardtype,typeline,artist,legalities,image) VALUES ('Llanowar Elves','{G}',1,'["G"]','["G"]',1,1,'{T}: Add {G}.',NULL,'','Creature','Elf Druid','Kev Walker','{"standard": "legal", "future": "legal", "historic": "legal", "timeless": "legal", "gladiator": "legal", "pioneer": "legal", "explorer": "legal", "modern": "legal", "legacy": "legal", "pauper": "legal", "vintage": "legal", "penny": "not_legal", "commander": "legal", "oathbreaker": "legal", "standardbrawl": "legal", "brawl": "legal", "alchemy": "legal", "paupercommander": "legal", "duel": "legal", "oldschool": "not_legal", "premodern": "legal", "predh": "legal"}','https://cards.scryfall.io/normal/front/0/1/01c6f877-6b00-4d57-8a88-36cd3b16edbc.jpg?1562630529');
INSERT OR IGNORE INTO cards (name,manacost,cmc,colors,coloridentity,power,toughness,oracletext,loyalty,supertype,cardtype,typeline,artist,legalities,image) VALUES ('Island','',0,'[]','["U"]',NULL,NULL,'({T}: Add {U}.)',NULL,'Basic','Land','Island','Lucas Graciano','{"standard": "legal", "future": "legal", "historic": "legal", "timeless": "legal", "gladiator": "legal", "pioneer": "legal", "explorer": "legal", "modern": "legal", "legacy": "legal", "pauper": "legal", "vintage": "legal", "penny": "legal", "commander": "legal", "oathbreaker": "legal", "standardbrawl": "legal", "brawl": "legal", "alchemy": "legal", "paupercommander": "legal", "duel": "legal", "oldschool": "not_legal", "premodern": "legal", "predh": "legal"}','https://cards.scryfall.io/normal/front/0/0/000f1f50-08e5-4d83-8159-98f06a0e2279.jpg?1572491305');
