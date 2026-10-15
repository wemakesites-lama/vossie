-- Vossie's foundation (supabase foundation plan, Task 3; backend spec 4.1): the private schema, the extensions, the
-- helpers every later migration uses, and a backstop that refuses a public table without row level security.
--
-- How `private` stays closed while policies still use its helpers:
-- - anon and authenticated have no USAGE on `private`, so they can't name anything in it, and `private` is never in
--   the API's exposed schemas (config.toml).
-- - A policy is stored as a parsed tree that points at its functions by oid, so evaluating it checks only EXECUTE on
--   each function, never USAGE on the function's schema. Each later migration grants EXECUTE on exactly the helpers its
--   policies call (is_staff, owns_shop, shop_is_public, conversation_side), and nothing else.
-- - New functions in `private` are not executable by PUBLIC (the default privilege below), so a helper is closed until
--   a migration opens it. The private tables get no grants to anon or authenticated at all.
-- The tests in supabase/tests/ check both halves: the policies work for anon and authenticated, and those roles can't
-- call a private function by name.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Functions made in `private` from here on run only for roles a migration grants them to.
alter default privileges in schema private revoke execute on functions from public;

-- Extensions. pg_cron goes in pg_catalog, as Supabase's docs ask. pgTAP isn't installed by a migration: `supabase test
-- db` adds it for the test run and removes it after, so it never reaches staging or production.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- A short random id (spec 4.1): 10 characters of a to z and 0 to 9, for listings, requests and Hub posts, whose ids
-- appear in links and in the vossie_saved cookie. Bytes of 252 and above are skipped, so each character is equally
-- likely (252 is 7 times 36).
create function private.new_short_id()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  bytes bytea;
  b int;
  id text := '';
begin
  while pg_catalog.char_length(id) < 10 loop
    bytes := extensions.gen_random_bytes(16);
    for i in 0..15 loop
      b := pg_catalog.get_byte(bytes, i);
      if b < 252 then
        id := id || pg_catalog.substr(alphabet, b % 36 + 1, 1);
        exit when pg_catalog.char_length(id) = 10;
      end if;
    end loop;
  end loop;
  return id;
end;
$$;

-- A shop name as names are compared: nameKey in lib/selling/rules.ts, step for step.
--   1. NFKD;  2. drop ' and ’;  3. drop every mark (\p{M});  4. lower case (Unicode's full mapping, through ICU's root
--   locale, so the database's own locale never matters);  5. each run of anything but a letter or number (\p{L}, \p{N})
--   becomes one space;  6. trim.
-- Postgres's regular expressions have no \p{…} classes, and [[:alpha:]] follows the collation's idea of a letter, which
-- isn't \p{L}. So the two classes are written out as ranges, generated from JavaScript's own \p{M} and [\p{L}\p{N}]
-- (Unicode 17) and pasted here. unaccent isn't used: its rules differ from NFKD (it turns ß into ss and ø into o, where
-- nameKey keeps both). The pgTAP test runs nameKey's own cases and more, with values printed by nameKey in Node.
create function private.name_key(name text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.btrim(
    pg_catalog.regexp_replace(
      pg_catalog.lower(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(pg_catalog.normalize(name, 'NFKD'), '[''’]', '', 'g'),
          '[' || '\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1-\u05c2\u05c4-\u05c5\u05c7\u0610-\u061a'
            || '\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7-\u06e8\u06ea-\u06ed\u0711\u0730-\u074a'
            || '\u07a6-\u07b0\u07eb-\u07f3\u07fd\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d'
            || '\u0859-\u085b\u0897-\u089f\u08ca-\u08e1\u08e3-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957'
            || '\u0962-\u0963\u0981-\u0983\u09bc\u09be-\u09c4\u09c7-\u09c8\u09cb-\u09cd\u09d7\u09e2-\u09e3\u09fe'
            || '\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47-\u0a48\u0a4b-\u0a4d\u0a51\u0a70-\u0a71\u0a75\u0a81-\u0a83'
            || '\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2-\u0ae3\u0afa-\u0aff\u0b01-\u0b03\u0b3c'
            || '\u0b3e-\u0b44\u0b47-\u0b48\u0b4b-\u0b4d\u0b55-\u0b57\u0b62-\u0b63\u0b82\u0bbe-\u0bc2'
            || '\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0c00-\u0c04\u0c3c\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d'
            || '\u0c55-\u0c56\u0c62-\u0c63\u0c81-\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd'
            || '\u0cd5-\u0cd6\u0ce2-\u0ce3\u0cf3\u0d00-\u0d03\u0d3b-\u0d3c\u0d3e-\u0d44\u0d46-\u0d48'
            || '\u0d4a-\u0d4d\u0d57\u0d62-\u0d63\u0d81-\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2-\u0df3'
            || '\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0ebc\u0ec8-\u0ece\u0f18-\u0f19\u0f35\u0f37\u0f39'
            || '\u0f3e-\u0f3f\u0f71-\u0f84\u0f86-\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e'
            || '\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f'
            || '\u109a-\u109d\u135d-\u135f\u1712-\u1715\u1732-\u1734\u1752-\u1753\u1772-\u1773\u17b4-\u17d3'
            || '\u17dd\u180b-\u180d\u180f\u1885-\u1886\u18a9\u1920-\u192b\u1930-\u193b\u1a17-\u1a1b\u1a55-\u1a5e'
            || '\u1a60-\u1a7c\u1a7f\u1ab0-\u1add\u1ae0-\u1aeb\u1b00-\u1b04\u1b34-\u1b44\u1b6b-\u1b73'
            || '\u1b80-\u1b82\u1ba1-\u1bad\u1be6-\u1bf3\u1c24-\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf4'
            || '\u1cf7-\u1cf9\u1dc0-\u1dff\u20d0-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f'
            || '\u3099-\u309a\ua66f-\ua672\ua674-\ua67d\ua69e-\ua69f\ua6f0-\ua6f1\ua802\ua806\ua80b\ua823-\ua827'
            || '\ua82c\ua880-\ua881\ua8b4-\ua8c5\ua8e0-\ua8f1\ua8ff\ua926-\ua92d\ua947-\ua953\ua980-\ua983'
            || '\ua9b3-\ua9c0\ua9e5\uaa29-\uaa36\uaa43\uaa4c-\uaa4d\uaa7b-\uaa7d\uaab0\uaab2-\uaab4\uaab7-\uaab8'
            || '\uaabe-\uaabf\uaac1\uaaeb-\uaaef\uaaf5-\uaaf6\uabe3-\uabea\uabec-\uabed\ufb1e\ufe00-\ufe0f'
            || '\ufe20-\ufe2f\U000101fd\U000102e0\U00010376-\U0001037a\U00010a01-\U00010a03\U00010a05-\U00010a06'
            || '\U00010a0c-\U00010a0f\U00010a38-\U00010a3a\U00010a3f\U00010ae5-\U00010ae6\U00010d24-\U00010d27'
            || '\U00010d69-\U00010d6d\U00010eab-\U00010eac\U00010efa-\U00010eff\U00010f46-\U00010f50'
            || '\U00010f82-\U00010f85\U00011000-\U00011002\U00011038-\U00011046\U00011070\U00011073-\U00011074'
            || '\U0001107f-\U00011082\U000110b0-\U000110ba\U000110c2\U00011100-\U00011102\U00011127-\U00011134'
            || '\U00011145-\U00011146\U00011173\U00011180-\U00011182\U000111b3-\U000111c0\U000111c9-\U000111cc'
            || '\U000111ce-\U000111cf\U0001122c-\U00011237\U0001123e\U00011241\U000112df-\U000112ea'
            || '\U00011300-\U00011303\U0001133b-\U0001133c\U0001133e-\U00011344\U00011347-\U00011348'
            || '\U0001134b-\U0001134d\U00011357\U00011362-\U00011363\U00011366-\U0001136c\U00011370-\U00011374'
            || '\U000113b8-\U000113c0\U000113c2\U000113c5\U000113c7-\U000113ca\U000113cc-\U000113d0\U000113d2'
            || '\U000113e1-\U000113e2\U00011435-\U00011446\U0001145e\U000114b0-\U000114c3\U000115af-\U000115b5'
            || '\U000115b8-\U000115c0\U000115dc-\U000115dd\U00011630-\U00011640\U000116ab-\U000116b7'
            || '\U0001171d-\U0001172b\U0001182c-\U0001183a\U00011930-\U00011935\U00011937-\U00011938'
            || '\U0001193b-\U0001193e\U00011940\U00011942-\U00011943\U000119d1-\U000119d7\U000119da-\U000119e0'
            || '\U000119e4\U00011a01-\U00011a0a\U00011a33-\U00011a39\U00011a3b-\U00011a3e\U00011a47'
            || '\U00011a51-\U00011a5b\U00011a8a-\U00011a99\U00011b60-\U00011b67\U00011c2f-\U00011c36'
            || '\U00011c38-\U00011c3f\U00011c92-\U00011ca7\U00011ca9-\U00011cb6\U00011d31-\U00011d36\U00011d3a'
            || '\U00011d3c-\U00011d3d\U00011d3f-\U00011d45\U00011d47\U00011d8a-\U00011d8e\U00011d90-\U00011d91'
            || '\U00011d93-\U00011d97\U00011ef3-\U00011ef6\U00011f00-\U00011f01\U00011f03\U00011f34-\U00011f3a'
            || '\U00011f3e-\U00011f42\U00011f5a\U00013440\U00013447-\U00013455\U0001611e-\U0001612f'
            || '\U00016af0-\U00016af4\U00016b30-\U00016b36\U00016f4f\U00016f51-\U00016f87\U00016f8f-\U00016f92'
            || '\U00016fe4\U00016ff0-\U00016ff1\U0001bc9d-\U0001bc9e\U0001cf00-\U0001cf2d\U0001cf30-\U0001cf46'
            || '\U0001d165-\U0001d169\U0001d16d-\U0001d172\U0001d17b-\U0001d182\U0001d185-\U0001d18b'
            || '\U0001d1aa-\U0001d1ad\U0001d242-\U0001d244\U0001da00-\U0001da36\U0001da3b-\U0001da6c\U0001da75'
            || '\U0001da84\U0001da9b-\U0001da9f\U0001daa1-\U0001daaf\U0001e000-\U0001e006\U0001e008-\U0001e018'
            || '\U0001e01b-\U0001e021\U0001e023-\U0001e024\U0001e026-\U0001e02a\U0001e08f\U0001e130-\U0001e136'
            || '\U0001e2ae\U0001e2ec-\U0001e2ef\U0001e4ec-\U0001e4ef\U0001e5ee-\U0001e5ef\U0001e6e3\U0001e6e6'
            || '\U0001e6ee-\U0001e6ef\U0001e6f5\U0001e8d0-\U0001e8d6\U0001e944-\U0001e94a\U000e0100-\U000e01ef'
            || ']', '', 'g'
        ) collate pg_catalog."und-x-icu"
      ),
      '[^' || '\u0030-\u0039\u0041-\u005a\u0061-\u007a\u00aa\u00b2-\u00b3\u00b5\u00b9-\u00ba\u00bc-\u00be'
        || '\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374'
        || '\u0376-\u0377\u037a-\u037d\u037f\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481'
        || '\u048a-\u052f\u0531-\u0556\u0559\u0560-\u0588\u05d0-\u05ea\u05ef-\u05f2\u0620-\u064a'
        || '\u0660-\u0669\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06fc\u06ff\u0710\u0712-\u072f'
        || '\u074d-\u07a5\u07b1\u07c0-\u07ea\u07f4-\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858'
        || '\u0860-\u086a\u0870-\u0887\u0889-\u088f\u08a0-\u08c9\u0904-\u0939\u093d\u0950\u0958-\u0961'
        || '\u0966-\u096f\u0971-\u0980\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2'
        || '\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09e6-\u09f1\u09f4-\u09f9\u09fc\u0a05-\u0a0a'
        || '\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c'
        || '\u0a5e\u0a66-\u0a6f\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0'
        || '\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0ae6-\u0aef\u0af9\u0b05-\u0b0c\u0b0f-\u0b10'
        || '\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61'
        || '\u0b66-\u0b6f\u0b71-\u0b77\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c'
        || '\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0be6-\u0bf2\u0c05-\u0c0c'
        || '\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d\u0c58-\u0c5a\u0c5c-\u0c5d\u0c60-\u0c61'
        || '\u0c66-\u0c6f\u0c78-\u0c7e\u0c80\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3'
        || '\u0cb5-\u0cb9\u0cbd\u0cdc-\u0cde\u0ce0-\u0ce1\u0ce6-\u0cef\u0cf1-\u0cf2\u0d04-\u0d0c'
        || '\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d54-\u0d56\u0d58-\u0d61\u0d66-\u0d78\u0d7a-\u0d7f'
        || '\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0de6-\u0def\u0e01-\u0e30'
        || '\u0e32-\u0e33\u0e40-\u0e46\u0e50-\u0e59\u0e81-\u0e82\u0e84\u0e86-\u0e8a\u0e8c-\u0ea3\u0ea5'
        || '\u0ea7-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0ed0-\u0ed9\u0edc-\u0edf\u0f00\u0f20-\u0f33'
        || '\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f-\u1049\u1050-\u1055\u105a-\u105d'
        || '\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u1090-\u1099\u10a0-\u10c5\u10c7\u10cd'
        || '\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288'
        || '\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6'
        || '\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1369-\u137c\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd'
        || '\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f8\u1700-\u1711\u171f-\u1731'
        || '\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u17e0-\u17e9\u17f0-\u17f9'
        || '\u1810-\u1819\u1820-\u1878\u1880-\u1884\u1887-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191e'
        || '\u1946-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u19d0-\u19da\u1a00-\u1a16\u1a20-\u1a54'
        || '\u1a80-\u1a89\u1a90-\u1a99\u1aa7\u1b05-\u1b33\u1b45-\u1b4c\u1b50-\u1b59\u1b83-\u1ba0'
        || '\u1bae-\u1be5\u1c00-\u1c23\u1c40-\u1c49\u1c4d-\u1c7d\u1c80-\u1c8a\u1c90-\u1cba\u1cbd-\u1cbf'
        || '\u1ce9-\u1cec\u1cee-\u1cf3\u1cf5-\u1cf6\u1cfa\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d'
        || '\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc'
        || '\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4'
        || '\u1ff6-\u1ffc\u2070-\u2071\u2074-\u2079\u207f-\u2089\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115'
        || '\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e'
        || '\u2150-\u2189\u2460-\u249b\u24ea-\u24ff\u2776-\u2793\u2c00-\u2ce4\u2ceb-\u2cee\u2cf2-\u2cf3'
        || '\u2cfd\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae'
        || '\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f'
        || '\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa'
        || '\u30fc-\u30ff\u3105-\u312f\u3131-\u318e\u3192-\u3195\u31a0-\u31bf\u31f0-\u31ff\u3220-\u3229'
        || '\u3248-\u324f\u3251-\u325f\u3280-\u3289\u32b1-\u32bf\u3400-\u4dbf\u4e00-\ua48c\ua4d0-\ua4fd'
        || '\ua500-\ua60c\ua610-\ua62b\ua640-\ua66e\ua67f-\ua69d\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788'
        || '\ua78b-\ua7dc\ua7f1-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua830-\ua835\ua840-\ua873'
        || '\ua882-\ua8b3\ua8d0-\ua8d9\ua8f2-\ua8f7\ua8fb\ua8fd-\ua8fe\ua900-\ua925\ua930-\ua946'
        || '\ua960-\ua97c\ua984-\ua9b2\ua9cf-\ua9d9\ua9e0-\ua9e4\ua9e6-\ua9fe\uaa00-\uaa28\uaa40-\uaa42'
        || '\uaa44-\uaa4b\uaa50-\uaa59\uaa60-\uaa76\uaa7a\uaa7e-\uaaaf\uaab1\uaab5-\uaab6\uaab9-\uaabd\uaac0'
        || '\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16'
        || '\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab69\uab70-\uabe2\uabf0-\uabf9\uac00-\ud7a3'
        || '\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d'
        || '\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1'
        || '\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19'
        || '\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc'
        || '\U00010000-\U0001000b\U0001000d-\U00010026\U00010028-\U0001003a\U0001003c-\U0001003d'
        || '\U0001003f-\U0001004d\U00010050-\U0001005d\U00010080-\U000100fa\U00010107-\U00010133'
        || '\U00010140-\U00010178\U0001018a-\U0001018b\U00010280-\U0001029c\U000102a0-\U000102d0'
        || '\U000102e1-\U000102fb\U00010300-\U00010323\U0001032d-\U0001034a\U00010350-\U00010375'
        || '\U00010380-\U0001039d\U000103a0-\U000103c3\U000103c8-\U000103cf\U000103d1-\U000103d5'
        || '\U00010400-\U0001049d\U000104a0-\U000104a9\U000104b0-\U000104d3\U000104d8-\U000104fb'
        || '\U00010500-\U00010527\U00010530-\U00010563\U00010570-\U0001057a\U0001057c-\U0001058a'
        || '\U0001058c-\U00010592\U00010594-\U00010595\U00010597-\U000105a1\U000105a3-\U000105b1'
        || '\U000105b3-\U000105b9\U000105bb-\U000105bc\U000105c0-\U000105f3\U00010600-\U00010736'
        || '\U00010740-\U00010755\U00010760-\U00010767\U00010780-\U00010785\U00010787-\U000107b0'
        || '\U000107b2-\U000107ba\U00010800-\U00010805\U00010808\U0001080a-\U00010835\U00010837-\U00010838'
        || '\U0001083c\U0001083f-\U00010855\U00010858-\U00010876\U00010879-\U0001089e\U000108a7-\U000108af'
        || '\U000108e0-\U000108f2\U000108f4-\U000108f5\U000108fb-\U0001091b\U00010920-\U00010939'
        || '\U00010940-\U00010959\U00010980-\U000109b7\U000109bc-\U000109cf\U000109d2-\U00010a00'
        || '\U00010a10-\U00010a13\U00010a15-\U00010a17\U00010a19-\U00010a35\U00010a40-\U00010a48'
        || '\U00010a60-\U00010a7e\U00010a80-\U00010a9f\U00010ac0-\U00010ac7\U00010ac9-\U00010ae4'
        || '\U00010aeb-\U00010aef\U00010b00-\U00010b35\U00010b40-\U00010b55\U00010b58-\U00010b72'
        || '\U00010b78-\U00010b91\U00010ba9-\U00010baf\U00010c00-\U00010c48\U00010c80-\U00010cb2'
        || '\U00010cc0-\U00010cf2\U00010cfa-\U00010d23\U00010d30-\U00010d39\U00010d40-\U00010d65'
        || '\U00010d6f-\U00010d85\U00010e60-\U00010e7e\U00010e80-\U00010ea9\U00010eb0-\U00010eb1'
        || '\U00010ec2-\U00010ec7\U00010f00-\U00010f27\U00010f30-\U00010f45\U00010f51-\U00010f54'
        || '\U00010f70-\U00010f81\U00010fb0-\U00010fcb\U00010fe0-\U00010ff6\U00011003-\U00011037'
        || '\U00011052-\U0001106f\U00011071-\U00011072\U00011075\U00011083-\U000110af\U000110d0-\U000110e8'
        || '\U000110f0-\U000110f9\U00011103-\U00011126\U00011136-\U0001113f\U00011144\U00011147'
        || '\U00011150-\U00011172\U00011176\U00011183-\U000111b2\U000111c1-\U000111c4\U000111d0-\U000111da'
        || '\U000111dc\U000111e1-\U000111f4\U00011200-\U00011211\U00011213-\U0001122b\U0001123f-\U00011240'
        || '\U00011280-\U00011286\U00011288\U0001128a-\U0001128d\U0001128f-\U0001129d\U0001129f-\U000112a8'
        || '\U000112b0-\U000112de\U000112f0-\U000112f9\U00011305-\U0001130c\U0001130f-\U00011310'
        || '\U00011313-\U00011328\U0001132a-\U00011330\U00011332-\U00011333\U00011335-\U00011339\U0001133d'
        || '\U00011350\U0001135d-\U00011361\U00011380-\U00011389\U0001138b\U0001138e\U00011390-\U000113b5'
        || '\U000113b7\U000113d1\U000113d3\U00011400-\U00011434\U00011447-\U0001144a\U00011450-\U00011459'
        || '\U0001145f-\U00011461\U00011480-\U000114af\U000114c4-\U000114c5\U000114c7\U000114d0-\U000114d9'
        || '\U00011580-\U000115ae\U000115d8-\U000115db\U00011600-\U0001162f\U00011644\U00011650-\U00011659'
        || '\U00011680-\U000116aa\U000116b8\U000116c0-\U000116c9\U000116d0-\U000116e3\U00011700-\U0001171a'
        || '\U00011730-\U0001173b\U00011740-\U00011746\U00011800-\U0001182b\U000118a0-\U000118f2'
        || '\U000118ff-\U00011906\U00011909\U0001190c-\U00011913\U00011915-\U00011916\U00011918-\U0001192f'
        || '\U0001193f\U00011941\U00011950-\U00011959\U000119a0-\U000119a7\U000119aa-\U000119d0\U000119e1'
        || '\U000119e3\U00011a00\U00011a0b-\U00011a32\U00011a3a\U00011a50\U00011a5c-\U00011a89\U00011a9d'
        || '\U00011ab0-\U00011af8\U00011bc0-\U00011be0\U00011bf0-\U00011bf9\U00011c00-\U00011c08'
        || '\U00011c0a-\U00011c2e\U00011c40\U00011c50-\U00011c6c\U00011c72-\U00011c8f\U00011d00-\U00011d06'
        || '\U00011d08-\U00011d09\U00011d0b-\U00011d30\U00011d46\U00011d50-\U00011d59\U00011d60-\U00011d65'
        || '\U00011d67-\U00011d68\U00011d6a-\U00011d89\U00011d98\U00011da0-\U00011da9\U00011db0-\U00011ddb'
        || '\U00011de0-\U00011de9\U00011ee0-\U00011ef2\U00011f02\U00011f04-\U00011f10\U00011f12-\U00011f33'
        || '\U00011f50-\U00011f59\U00011fb0\U00011fc0-\U00011fd4\U00012000-\U00012399\U00012400-\U0001246e'
        || '\U00012480-\U00012543\U00012f90-\U00012ff0\U00013000-\U0001342f\U00013441-\U00013446'
        || '\U00013460-\U000143fa\U00014400-\U00014646\U00016100-\U0001611d\U00016130-\U00016139'
        || '\U00016800-\U00016a38\U00016a40-\U00016a5e\U00016a60-\U00016a69\U00016a70-\U00016abe'
        || '\U00016ac0-\U00016ac9\U00016ad0-\U00016aed\U00016b00-\U00016b2f\U00016b40-\U00016b43'
        || '\U00016b50-\U00016b59\U00016b5b-\U00016b61\U00016b63-\U00016b77\U00016b7d-\U00016b8f'
        || '\U00016d40-\U00016d6c\U00016d70-\U00016d79\U00016e40-\U00016e96\U00016ea0-\U00016eb8'
        || '\U00016ebb-\U00016ed3\U00016f00-\U00016f4a\U00016f50\U00016f93-\U00016f9f\U00016fe0-\U00016fe1'
        || '\U00016fe3\U00016ff2-\U00016ff6\U00017000-\U00018cd5\U00018cff-\U00018d1e\U00018d80-\U00018df2'
        || '\U0001aff0-\U0001aff3\U0001aff5-\U0001affb\U0001affd-\U0001affe\U0001b000-\U0001b122\U0001b132'
        || '\U0001b150-\U0001b152\U0001b155\U0001b164-\U0001b167\U0001b170-\U0001b2fb\U0001bc00-\U0001bc6a'
        || '\U0001bc70-\U0001bc7c\U0001bc80-\U0001bc88\U0001bc90-\U0001bc99\U0001ccf0-\U0001ccf9'
        || '\U0001d2c0-\U0001d2d3\U0001d2e0-\U0001d2f3\U0001d360-\U0001d378\U0001d400-\U0001d454'
        || '\U0001d456-\U0001d49c\U0001d49e-\U0001d49f\U0001d4a2\U0001d4a5-\U0001d4a6\U0001d4a9-\U0001d4ac'
        || '\U0001d4ae-\U0001d4b9\U0001d4bb\U0001d4bd-\U0001d4c3\U0001d4c5-\U0001d505\U0001d507-\U0001d50a'
        || '\U0001d50d-\U0001d514\U0001d516-\U0001d51c\U0001d51e-\U0001d539\U0001d53b-\U0001d53e'
        || '\U0001d540-\U0001d544\U0001d546\U0001d54a-\U0001d550\U0001d552-\U0001d6a5\U0001d6a8-\U0001d6c0'
        || '\U0001d6c2-\U0001d6da\U0001d6dc-\U0001d6fa\U0001d6fc-\U0001d714\U0001d716-\U0001d734'
        || '\U0001d736-\U0001d74e\U0001d750-\U0001d76e\U0001d770-\U0001d788\U0001d78a-\U0001d7a8'
        || '\U0001d7aa-\U0001d7c2\U0001d7c4-\U0001d7cb\U0001d7ce-\U0001d7ff\U0001df00-\U0001df1e'
        || '\U0001df25-\U0001df2a\U0001e030-\U0001e06d\U0001e100-\U0001e12c\U0001e137-\U0001e13d'
        || '\U0001e140-\U0001e149\U0001e14e\U0001e290-\U0001e2ad\U0001e2c0-\U0001e2eb\U0001e2f0-\U0001e2f9'
        || '\U0001e4d0-\U0001e4eb\U0001e4f0-\U0001e4f9\U0001e5d0-\U0001e5ed\U0001e5f0-\U0001e5fa'
        || '\U0001e6c0-\U0001e6de\U0001e6e0-\U0001e6e2\U0001e6e4-\U0001e6e5\U0001e6e7-\U0001e6ed'
        || '\U0001e6f0-\U0001e6f4\U0001e6fe-\U0001e6ff\U0001e7e0-\U0001e7e6\U0001e7e8-\U0001e7eb'
        || '\U0001e7ed-\U0001e7ee\U0001e7f0-\U0001e7fe\U0001e800-\U0001e8c4\U0001e8c7-\U0001e8cf'
        || '\U0001e900-\U0001e943\U0001e94b\U0001e950-\U0001e959\U0001ec71-\U0001ecab\U0001ecad-\U0001ecaf'
        || '\U0001ecb1-\U0001ecb4\U0001ed01-\U0001ed2d\U0001ed2f-\U0001ed3d\U0001ee00-\U0001ee03'
        || '\U0001ee05-\U0001ee1f\U0001ee21-\U0001ee22\U0001ee24\U0001ee27\U0001ee29-\U0001ee32'
        || '\U0001ee34-\U0001ee37\U0001ee39\U0001ee3b\U0001ee42\U0001ee47\U0001ee49\U0001ee4b'
        || '\U0001ee4d-\U0001ee4f\U0001ee51-\U0001ee52\U0001ee54\U0001ee57\U0001ee59\U0001ee5b\U0001ee5d'
        || '\U0001ee5f\U0001ee61-\U0001ee62\U0001ee64\U0001ee67-\U0001ee6a\U0001ee6c-\U0001ee72'
        || '\U0001ee74-\U0001ee77\U0001ee79-\U0001ee7c\U0001ee7e\U0001ee80-\U0001ee89\U0001ee8b-\U0001ee9b'
        || '\U0001eea1-\U0001eea3\U0001eea5-\U0001eea9\U0001eeab-\U0001eebb\U0001f100-\U0001f10c'
        || '\U0001fbf0-\U0001fbf9\U00020000-\U0002a6df\U0002a700-\U0002b81d\U0002b820-\U0002cead'
        || '\U0002ceb0-\U0002ebe0\U0002ebf0-\U0002ee5d\U0002f800-\U0002fa1d\U00030000-\U0003134a'
        || '\U00031350-\U00033479'
        || ']+', ' ', 'g'
    ),
    ' '
  );
$$;

-- The South African day a moment falls on (SAST, UTC+2, no daylight saving), whatever the server's time zone.
create function private.sast_day(t timestamptz)
returns date
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select (t at time zone 'Africa/Johannesburg')::date;
$$;

-- User text as the app stores it (cleanText in lib/messaging/rules.ts): no control characters but line breaks and tabs,
-- and none of the invisible or direction-changing characters cleanText drops (the direction embeddings, overrides and
-- isolates U+202A to U+202E and U+2066 to U+2069, the zero-width space U+200B, the marks U+200E and U+200F, the word
-- joiner U+2060 and the byte order mark U+FEFF; the zero-width joiner stays, for emoji). The app cleans text before
-- saving, so these checks only refuse what it would never send: they're the backstop for the admin client and for a
-- mistake in the app. A carriage return is refused too: cleanText turns "\r\n" and "\r" into "\n".
create function private.is_clean_text(t text)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select t !~ '[\u0001-\u0008\u000b-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]';
$$;

-- One line of user text (cleanLine in lib/selling/rules.ts): clean text, and no line breaks or tabs either, since
-- cleanLine turns every run of white space into one space. For titles, names, taglines and swap wishes. Written out
-- rather than calling is_clean_text: a check constraint runs as the writing role, which can call a function in
-- `private` by its grant but can't name one (no USAGE on the schema).
create function private.is_clean_line(t text)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select t !~ '[\u0001-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]';
$$;

-- The functions are the database's own: the owner and the service role may run them; nobody else unless a later
-- migration says so. The service role runs new_short_id and name_key when the admin client inserts a listing or a
-- shop (a column's default, a generated column and a check constraint run as the inserting role), and the text checks
-- when it writes a table that uses them.
revoke all on function private.new_short_id() from public, anon, authenticated;
revoke all on function private.name_key(text) from public, anon, authenticated;
revoke all on function private.sast_day(timestamptz) from public, anon, authenticated;
revoke all on function private.is_clean_text(text), private.is_clean_line(text) from public, anon, authenticated;
grant execute on function private.new_short_id() to service_role;
grant execute on function private.name_key(text) to service_role;
grant execute on function private.sast_day(timestamptz) to service_role;
grant execute on function private.is_clean_text(text), private.is_clean_line(text) to service_role;

-- The RLS backstop (defence in depth; spec decision 7). Postgres can't turn RLS on in CREATE TABLE, so a migration
-- creates a table and turns RLS on in a later statement. The check therefore waits for the end of the transaction:
-- an event trigger notes every table created or altered in `public`, and a deferred constraint trigger looks at each
-- one when the transaction commits. A migration runs as one transaction, so a table still without RLS at its end
-- fails the whole migration. It catches RLS turned off later as well (ALTER TABLE … DISABLE ROW LEVEL SECURITY).
create table private.rls_checks (
  id bigint generated always as identity primary key,
  table_oid oid not null
);
revoke all on table private.rls_checks from public, anon, authenticated;

create function private.check_rls()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  select n.nspname, c.relname, c.relrowsecurity into t
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where c.oid = new.table_oid;
  -- A table dropped again in the same transaction is no longer there, and needs nothing.
  if found and t.nspname = 'public' and not t.relrowsecurity then
    raise exception '%.% has no row level security: turn it on in the migration that creates it',
      pg_catalog.quote_ident(t.nspname), pg_catalog.quote_ident(t.relname)
      using errcode = 'insufficient_privilege';
  end if;
  delete from private.rls_checks where id = new.id;
  return null;
end;
$$;
revoke all on function private.check_rls() from public, anon, authenticated;

create constraint trigger rls_on_by_commit
after insert on private.rls_checks
deferrable initially deferred
for each row execute function private.check_rls();

create function private.queue_rls_check()
returns event_trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cmd record;
begin
  for cmd in
    select objid from pg_catalog.pg_event_trigger_ddl_commands()
    where object_type in ('table', 'partitioned table') and schema_name = 'public'
  loop
    insert into private.rls_checks (table_oid) values (cmd.objid);
  end loop;
end;
$$;
revoke all on function private.queue_rls_check() from public, anon, authenticated;

create event trigger vossie_rls_check
on ddl_command_end
when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE')
execute function private.queue_rls_check();
