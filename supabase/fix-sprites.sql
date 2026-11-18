-- ─────────────────────────────────────────────────────────────────────────────
-- Fixes broken Pokémon images (run once in the Supabase SQL editor; safe to re-run).
-- Every link below was checked on Showdown. Only these Pokémon are touched.
-- ─────────────────────────────────────────────────────────────────────────────

-- Names Showdown writes without the hyphen / space / punctuation (Ting-Lu → tinglu)
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/hooh.gif' where lower(name) = lower('Ho-Oh');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/tinglu.gif' where lower(name) = lower('Ting-Lu');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/chienpao.gif' where lower(name) = lower('Chien-Pao');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/wochien.gif' where lower(name) = lower('Wo-Chien');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/chiyu.gif' where lower(name) = lower('Chi-Yu');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/jangmoo.gif' where lower(name) = lower('Jangmo-o');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/hakamoo.gif' where lower(name) = lower('Hakamo-o');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/kommoo.gif' where lower(name) = lower('Kommo-o');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/porygonz.gif' where lower(name) = lower('Porygon-Z');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/typenull.gif' where lower(name) = lower('Type: Null');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/tapukoko.gif' where lower(name) = lower('Tapu Koko');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/tapulele.gif' where lower(name) = lower('Tapu Lele');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/tapubulu.gif' where lower(name) = lower('Tapu Bulu');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/tapufini.gif' where lower(name) = lower('Tapu Fini');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/greattusk.gif' where lower(name) = lower('Great Tusk');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/screamtail.gif' where lower(name) = lower('Scream Tail');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/brutebonnet.gif' where lower(name) = lower('Brute Bonnet');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/fluttermane.gif' where lower(name) = lower('Flutter Mane');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/slitherwing.gif' where lower(name) = lower('Slither Wing');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/sandyshocks.gif' where lower(name) = lower('Sandy Shocks');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/roaringmoon.gif' where lower(name) = lower('Roaring Moon');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/walkingwake.gif' where lower(name) = lower('Walking Wake');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/gougingfire.gif' where lower(name) = lower('Gouging Fire');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/ragingbolt.gif' where lower(name) = lower('Raging Bolt');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/mrmime.gif' where lower(name) = lower('Mr. Mime');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/mimejr.gif' where lower(name) = lower('Mime Jr.');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/mrrime.gif' where lower(name) = lower('Mr. Rime');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/farfetchd.gif' where lower(name) = lower('Farfetch''d');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/sirfetchd.gif' where lower(name) = lower('Sirfetch''d');

-- Flabébé (the é was dropped from the old link)
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/flabebe.gif' where lower(name) = lower('Flabébé');

-- No 3D animated sprite on Showdown: pixel-art animated version instead
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/gen5ani/miraidon.gif' where lower(name) = lower('Miraidon');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/gen5ani/terapagos.gif' where lower(name) = lower('Terapagos');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/gen5ani/ironhands.gif' where lower(name) = lower('Iron Hands');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/gen5ani/ironmoth.gif' where lower(name) = lower('Iron Moth');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/gen5ani/ironthorns.gif' where lower(name) = lower('Iron Thorns');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/gen5ani/ironvaliant.gif' where lower(name) = lower('Iron Valiant');

-- No animated sprite at all on Showdown: still image
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/home/ironboulder.png' where lower(name) = lower('Iron Boulder');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/home/ironbundle.png' where lower(name) = lower('Iron Bundle');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/home/ironcrown.png' where lower(name) = lower('Iron Crown');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/home/ironjugulis.png' where lower(name) = lower('Iron Jugulis');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/home/ironleaves.png' where lower(name) = lower('Iron Leaves');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/home/irontreads.png' where lower(name) = lower('Iron Treads');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/home/ogerpon.png' where lower(name) = lower('Ogerpon');
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/home/pecharunt.png' where lower(name) = lower('Pecharunt');

-- Nidoran: both shared one picture before
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/nidoranf.gif' where name = 'Nidoran♀';
update pokemon set sprite_url = 'https://play.pokemonshowdown.com/sprites/ani/nidoranm.gif' where name = 'Nidoran♂';
