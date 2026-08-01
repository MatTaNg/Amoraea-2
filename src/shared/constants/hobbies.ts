export type Hobby = {
  id: string;
  name: string;
  category: string;
  /** Hidden from picker; kept so stored profile ids still resolve. */
  legacy?: boolean;
};

export const HOBBY_DEFINITION =
  'A hobby is something you do because you genuinely enjoy it — not because it\'s practical or expected. Cooking counts if you love experimenting in the kitchen; it doesn\'t if you\'re just making dinner to save money.';

export const MIN_HOBBY_SELECTIONS = 2;
export const MAX_HOBBY_SELECTIONS = 5;

export const HOBBY_CATEGORIES = [
  'Fitness & Movement',
  'Outdoors & Adventure',
  'Food & Drink',
  'Arts, Crafts & Home',
  'Music',
  'Reading & Writing',
  'Games, Screens & Pop Culture',
  'Tech & Making',
  'Wellness & Mindfulness',
  'Travel & Culture',
  'Social & Community',
  'Collecting',
  'Pets & Animals',
  'Learning & Intellectual',
] as const;

export type HobbyCategory = (typeof HOBBY_CATEGORIES)[number];

/** Global selectable hobby list (~111 items). */
export const HOBBIES: Hobby[] = [
  // Fitness & Movement
  { id: 'running', name: 'Running', category: 'Fitness & Movement' },
  { id: 'weightlifting', name: 'Weightlifting', category: 'Fitness & Movement' },
  { id: 'yoga', name: 'Yoga', category: 'Fitness & Movement' },
  { id: 'pilates', name: 'Pilates', category: 'Fitness & Movement' },
  { id: 'rock_climbing', name: 'Rock climbing', category: 'Fitness & Movement' },
  { id: 'cycling', name: 'Cycling', category: 'Fitness & Movement' },
  { id: 'swimming', name: 'Swimming', category: 'Fitness & Movement' },
  { id: 'boxing', name: 'Boxing', category: 'Fitness & Movement' },
  { id: 'martial_arts', name: 'Martial arts', category: 'Fitness & Movement' },
  { id: 'hiking', name: 'Hiking', category: 'Fitness & Movement' },
  { id: 'dance', name: 'Dance (any style)', category: 'Fitness & Movement' },

  // Outdoors & Adventure
  { id: 'camping', name: 'Camping', category: 'Outdoors & Adventure' },
  { id: 'fishing', name: 'Fishing', category: 'Outdoors & Adventure' },
  { id: 'hunting', name: 'Hunting', category: 'Outdoors & Adventure' },
  { id: 'kayaking', name: 'Kayaking', category: 'Outdoors & Adventure' },
  { id: 'surfing', name: 'Surfing', category: 'Outdoors & Adventure' },
  { id: 'skiing_snowboarding', name: 'Skiing / snowboarding', category: 'Outdoors & Adventure' },
  { id: 'mountain_biking', name: 'Mountain biking', category: 'Outdoors & Adventure' },
  { id: 'sailing', name: 'Sailing', category: 'Outdoors & Adventure' },
  { id: 'scuba_diving', name: 'Scuba diving', category: 'Outdoors & Adventure' },
  { id: 'stargazing_astronomy', name: 'Stargazing / astronomy', category: 'Outdoors & Adventure' },

  // Food & Drink
  { id: 'cooking', name: 'Cooking', category: 'Food & Drink' },
  { id: 'baking', name: 'Baking', category: 'Food & Drink' },
  { id: 'wine_spirits_tasting', name: 'Wine & spirits tasting', category: 'Food & Drink' },
  { id: 'craft_beer_brewing', name: 'Craft beer / brewing', category: 'Food & Drink' },
  { id: 'coffee', name: 'Coffee (roasting, brewing, cafe-hopping)', category: 'Food & Drink' },
  { id: 'cocktail_mixology', name: 'Cocktail making / mixology', category: 'Food & Drink' },
  { id: 'grilling_barbecue', name: 'Grilling / barbecue', category: 'Food & Drink' },
  {
    id: 'trying_new_restaurants_food_tourism',
    name: 'Trying new restaurants / food tourism',
    category: 'Food & Drink',
  },
  { id: 'fermenting_cheese_making', name: 'Fermenting & cheese making', category: 'Food & Drink' },

  // Arts, Crafts & Home
  { id: 'painting_drawing', name: 'Painting & drawing', category: 'Arts, Crafts & Home' },
  { id: 'photography', name: 'Photography', category: 'Arts, Crafts & Home' },
  { id: 'pottery_ceramics', name: 'Pottery / ceramics', category: 'Arts, Crafts & Home' },
  { id: 'woodworking', name: 'Woodworking', category: 'Arts, Crafts & Home' },
  { id: 'jewelry_making', name: 'Jewelry making', category: 'Arts, Crafts & Home' },
  { id: 'digital_art', name: 'Digital art', category: 'Arts, Crafts & Home' },
  {
    id: 'knitting_crochet_embroidery',
    name: 'Knitting / crochet / embroidery',
    category: 'Arts, Crafts & Home',
  },
  { id: 'fashion_design_sewing', name: 'Fashion design / sewing', category: 'Arts, Crafts & Home' },
  { id: 'interior_design', name: 'Interior design', category: 'Arts, Crafts & Home' },
  { id: 'furniture_restoration', name: 'Furniture restoration', category: 'Arts, Crafts & Home' },
  { id: 'gardening_houseplants', name: 'Gardening & houseplants', category: 'Arts, Crafts & Home' },
  { id: 'home_renovation_diy', name: 'Home renovation / DIY', category: 'Arts, Crafts & Home' },

  // Music
  { id: 'playing_instrument', name: 'Playing an instrument', category: 'Music' },
  { id: 'singing', name: 'Singing', category: 'Music' },
  { id: 'djing_producing_music', name: 'DJing / producing music', category: 'Music' },
  {
    id: 'concerts_music_festivals',
    name: 'Going to concerts / music festivals',
    category: 'Music',
  },
  { id: 'vinyl_record_collecting', name: 'Vinyl record collecting', category: 'Music' },
  { id: 'karaoke', name: 'Karaoke', category: 'Music' },
  { id: 'songwriting', name: 'Songwriting', category: 'Music' },

  // Reading & Writing
  { id: 'reading', name: 'Reading', category: 'Reading & Writing' },
  { id: 'poetry', name: 'Poetry', category: 'Reading & Writing' },
  { id: 'journaling', name: 'Journaling', category: 'Reading & Writing' },
  { id: 'book_clubs', name: 'Book clubs', category: 'Reading & Writing' },
  { id: 'creative_writing', name: 'Creative writing', category: 'Reading & Writing' },
  { id: 'comics_graphic_novels', name: 'Comics / graphic novels', category: 'Reading & Writing' },
  { id: 'audiobooks', name: 'Audiobooks', category: 'Reading & Writing' },

  // Games, Screens & Pop Culture
  { id: 'board_games', name: 'Board games', category: 'Games, Screens & Pop Culture' },
  { id: 'video_games', name: 'Video games', category: 'Games, Screens & Pop Culture' },
  { id: 'chess', name: 'Chess', category: 'Games, Screens & Pop Culture' },
  { id: 'poker_card_games', name: 'Poker / card games', category: 'Games, Screens & Pop Culture' },
  { id: 'trivia_nights', name: 'Trivia nights', category: 'Games, Screens & Pop Culture' },
  { id: 'escape_rooms', name: 'Escape rooms', category: 'Games, Screens & Pop Culture' },
  {
    id: 'tabletop_rpg',
    name: 'Tabletop RPGs (D&D, etc.)',
    category: 'Games, Screens & Pop Culture',
  },
  { id: 'movie_nights_tv', name: 'Movie nights & TV', category: 'Games, Screens & Pop Culture' },
  { id: 'anime', name: 'Anime', category: 'Games, Screens & Pop Culture' },
  {
    id: 'stand_up_comedy_theater',
    name: 'Stand-up comedy / theater',
    category: 'Games, Screens & Pop Culture',
  },
  { id: 'podcasts', name: 'Podcasts', category: 'Games, Screens & Pop Culture' },
  {
    id: 'true_crime_documentaries',
    name: 'True crime & documentaries',
    category: 'Games, Screens & Pop Culture',
  },

  // Tech & Making
  { id: 'coding_side_projects', name: 'Coding / side projects', category: 'Tech & Making' },
  { id: '3d_printing', name: '3D printing', category: 'Tech & Making' },
  {
    id: 'building_pcs_gaming_rigs',
    name: 'Building PCs / gaming rigs',
    category: 'Tech & Making',
  },
  { id: 'drone_flying', name: 'Drone flying', category: 'Tech & Making' },
  {
    id: 'car_motorcycle_maintenance',
    name: 'Car / motorcycle maintenance',
    category: 'Tech & Making',
  },
  {
    id: 'home_automation',
    name: 'Home automation / smart home tinkering',
    category: 'Tech & Making',
  },
  { id: 'robotics_electronics', name: 'Robotics / electronics', category: 'Tech & Making' },

  // Wellness & Mindfulness
  { id: 'meditation', name: 'Meditation', category: 'Wellness & Mindfulness' },
  { id: 'breathwork', name: 'Breathwork', category: 'Wellness & Mindfulness' },
  { id: 'sound_baths', name: 'Sound baths', category: 'Wellness & Mindfulness' },
  { id: 'cold_plunging', name: 'Cold plunging', category: 'Wellness & Mindfulness' },
  { id: 'sauna', name: 'Sauna', category: 'Wellness & Mindfulness' },
  { id: 'tarot_astrology', name: 'Tarot / astrology', category: 'Wellness & Mindfulness' },

  // Travel & Culture
  {
    id: 'international_solo_travel',
    name: 'International & solo travel',
    category: 'Travel & Culture',
  },
  { id: 'backpacking_abroad', name: 'Backpacking abroad', category: 'Travel & Culture' },
  { id: 'language_learning', name: 'Language learning', category: 'Travel & Culture' },
  { id: 'cultural_festivals', name: 'Cultural festivals', category: 'Travel & Culture' },
  {
    id: 'museums_historical_sites',
    name: 'Museums & historical sites',
    category: 'Travel & Culture',
  },

  // Social & Community
  { id: 'volunteering', name: 'Volunteering', category: 'Social & Community' },
  {
    id: 'hosting_dinner_parties_game_nights',
    name: 'Hosting dinner parties & game nights',
    category: 'Social & Community',
  },
  { id: 'community_organizing', name: 'Community organizing', category: 'Social & Community' },
  { id: 'mentoring', name: 'Mentoring', category: 'Social & Community' },
  {
    id: 'faith_spiritual_community',
    name: 'Faith / spiritual community',
    category: 'Social & Community',
  },
  {
    id: 'public_speaking_improv',
    name: 'Public speaking / improv',
    category: 'Social & Community',
  },

  // Collecting
  { id: 'sneakers', name: 'Sneakers', category: 'Collecting' },
  { id: 'vintage_clothing', name: 'Vintage clothing', category: 'Collecting' },
  { id: 'trading_cards', name: 'Trading cards', category: 'Collecting' },
  { id: 'antiques', name: 'Antiques', category: 'Collecting' },
  { id: 'watches', name: 'Watches', category: 'Collecting' },

  // Pets & Animals
  { id: 'dog_training', name: 'Dog training', category: 'Pets & Animals' },
  { id: 'dog_walking_hiking', name: 'Dog walking / hiking with dogs', category: 'Pets & Animals' },
  { id: 'horseback_riding', name: 'Horseback riding', category: 'Pets & Animals' },
  {
    id: 'animal_shelter_volunteering',
    name: 'Volunteering at animal shelters',
    category: 'Pets & Animals',
  },
  { id: 'birdkeeping', name: 'Birdkeeping', category: 'Pets & Animals' },
  { id: 'aquariums_fishkeeping', name: 'Aquariums / fishkeeping', category: 'Pets & Animals' },
  { id: 'wildlife_photography', name: 'Wildlife photography', category: 'Pets & Animals' },

  // Learning & Intellectual
  { id: 'philosophy', name: 'Philosophy', category: 'Learning & Intellectual' },
  { id: 'history', name: 'History', category: 'Learning & Intellectual' },
  { id: 'science_space', name: 'Science / space', category: 'Learning & Intellectual' },
  { id: 'psychology', name: 'Psychology', category: 'Learning & Intellectual' },
  {
    id: 'economics_investing',
    name: 'Economics / investing',
    category: 'Learning & Intellectual',
  },
  {
    id: 'politics_current_events',
    name: 'Politics / current events',
    category: 'Learning & Intellectual',
  },
  { id: 'debate', name: 'Debate', category: 'Learning & Intellectual' },

  // Legacy ids — resolve stored profiles; hidden from picker
  { id: 'crossfit', name: 'CrossFit', category: 'Legacy', legacy: true },
  { id: 'spin_classes', name: 'Spin classes', category: 'Legacy', legacy: true },
  { id: 'hiit_training', name: 'HIIT training', category: 'Legacy', legacy: true },
  { id: 'barre', name: 'Barre', category: 'Legacy', legacy: true },
  { id: 'calisthenics', name: 'Calisthenics', category: 'Legacy', legacy: true },
  { id: 'triathlon_training', name: 'Triathlon training', category: 'Legacy', legacy: true },
  { id: 'powerlifting', name: 'Powerlifting', category: 'Legacy', legacy: true },
  { id: 'backpacking', name: 'Backpacking', category: 'Legacy', legacy: true },
  { id: 'trail_running', name: 'Trail running', category: 'Legacy', legacy: true },
  { id: 'bird_watching', name: 'Bird watching', category: 'Legacy', legacy: true },
  { id: 'foraging', name: 'Foraging', category: 'Legacy', legacy: true },
  { id: 'van_life_road_trips', name: 'Van life / road trips', category: 'Legacy', legacy: true },
  { id: 'skydiving', name: 'Skydiving', category: 'Legacy', legacy: true },
  { id: 'off_roading', name: 'Off-roading', category: 'Legacy', legacy: true },
  { id: 'wine_tasting', name: 'Wine tasting', category: 'Legacy', legacy: true },
  { id: 'whiskey_spirits_tasting', name: 'Whiskey / spirits tasting', category: 'Legacy', legacy: true },
  { id: 'food_truck_hunting', name: 'Food truck hunting', category: 'Legacy', legacy: true },
  { id: 'trying_new_restaurants', name: 'Trying new restaurants', category: 'Legacy', legacy: true },
  { id: 'fermenting', name: 'Fermenting (kombucha, kimchi, etc.)', category: 'Legacy', legacy: true },
  { id: 'cheese_making', name: 'Cheese making', category: 'Legacy', legacy: true },
  { id: 'gardening_for_food', name: 'Gardening for food', category: 'Legacy', legacy: true },
  { id: 'painting', name: 'Painting', category: 'Legacy', legacy: true },
  { id: 'drawing_sketching', name: 'Drawing / sketching', category: 'Legacy', legacy: true },
  { id: 'sculpture', name: 'Sculpture', category: 'Legacy', legacy: true },
  { id: 'graphic_design', name: 'Graphic design', category: 'Legacy', legacy: true },
  { id: 'calligraphy', name: 'Calligraphy', category: 'Legacy', legacy: true },
  { id: 'film_photography', name: 'Film photography', category: 'Legacy', legacy: true },
  { id: 'knitting_crochet', name: 'Knitting / crochet', category: 'Legacy', legacy: true },
  { id: 'embroidery', name: 'Embroidery', category: 'Legacy', legacy: true },
  { id: 'candle_making', name: 'Candle making', category: 'Legacy', legacy: true },
  { id: 'tattoo_art', name: 'Tattooing / tattoo art appreciation', category: 'Legacy', legacy: true },
  { id: 'djing', name: 'DJing', category: 'Legacy', legacy: true },
  { id: 'producing_music', name: 'Producing music', category: 'Legacy', legacy: true },
  { id: 'going_to_concerts', name: 'Going to concerts', category: 'Legacy', legacy: true },
  { id: 'music_festivals', name: 'Music festivals', category: 'Legacy', legacy: true },
  { id: 'choir_a_cappella', name: 'Choir / a cappella', category: 'Legacy', legacy: true },
  { id: 'live_music_discovery', name: 'Live music discovery', category: 'Legacy', legacy: true },
  { id: 'vinyl_records', name: 'Vinyl records', category: 'Legacy', legacy: true },
  { id: 'reading_fiction', name: 'Reading fiction', category: 'Legacy', legacy: true },
  { id: 'reading_nonfiction', name: 'Reading nonfiction', category: 'Legacy', legacy: true },
  { id: 'blogging', name: 'Blogging', category: 'Legacy', legacy: true },
  { id: 'screenwriting', name: 'Screenwriting', category: 'Legacy', legacy: true },
  {
    id: 'language_learning_reading',
    name: 'Language learning through reading',
    category: 'Legacy',
    legacy: true,
  },
  { id: 'jigsaw_puzzles', name: 'Puzzles (jigsaw)', category: 'Legacy', legacy: true },
  { id: 'fantasy_sports', name: 'Fantasy sports', category: 'Legacy', legacy: true },
  { id: 'crosswords_word_games', name: 'Crosswords / word games', category: 'Legacy', legacy: true },
  { id: 'movie_nights', name: 'Movie nights', category: 'Legacy', legacy: true },
  { id: 'film_festivals', name: 'Film festivals', category: 'Legacy', legacy: true },
  { id: 'tv_show_marathons', name: 'TV show marathons', category: 'Legacy', legacy: true },
  { id: 'stand_up_comedy', name: 'Stand-up comedy', category: 'Legacy', legacy: true },
  { id: 'theater_musicals', name: 'Theater / musicals', category: 'Legacy', legacy: true },
  { id: 'true_crime', name: 'True crime', category: 'Legacy', legacy: true },
  { id: 'documentaries', name: 'Documentaries', category: 'Legacy', legacy: true },
  { id: 'reality_tv', name: 'Reality TV', category: 'Legacy', legacy: true },
  { id: 'robotics', name: 'Robotics', category: 'Legacy', legacy: true },
  { id: 'building_pcs', name: 'Building PCs', category: 'Legacy', legacy: true },
  { id: 'app_development', name: 'App development', category: 'Legacy', legacy: true },
  {
    id: 'electronics_circuit_building',
    name: 'Electronics / circuit building',
    category: 'Legacy',
    legacy: true,
  },
  {
    id: 'car_restoration_detailing',
    name: 'Car restoration / detailing',
    category: 'Legacy',
    legacy: true,
  },
  { id: 'motorcycle_maintenance', name: 'Motorcycle maintenance', category: 'Legacy', legacy: true },
  {
    id: 'journaling_reflection',
    name: 'Journaling for reflection',
    category: 'Legacy',
    legacy: true,
  },
  { id: 'international_travel', name: 'International travel', category: 'Legacy', legacy: true },
  { id: 'solo_travel', name: 'Solo travel', category: 'Legacy', legacy: true },
  { id: 'museum_going', name: 'Museum going', category: 'Legacy', legacy: true },
  { id: 'historical_sites', name: 'Historical sites', category: 'Legacy', legacy: true },
  { id: 'food_tourism', name: 'Food tourism', category: 'Legacy', legacy: true },
  { id: 'volunteering_abroad', name: 'Volunteering abroad', category: 'Legacy', legacy: true },
  {
    id: 'learning_local_cuisines',
    name: 'Learning local cuisines',
    category: 'Legacy',
    legacy: true,
  },
  { id: 'hosting_dinner_parties', name: 'Hosting dinner parties', category: 'Legacy', legacy: true },
  { id: 'trivia_leagues', name: 'Trivia leagues', category: 'Legacy', legacy: true },
  { id: 'rec_sports_leagues', name: 'Sports leagues (rec sports)', category: 'Legacy', legacy: true },
  { id: 'improv_comedy_classes', name: 'Improv / comedy classes', category: 'Legacy', legacy: true },
  {
    id: 'public_speaking_toastmasters',
    name: 'Public speaking / Toastmasters',
    category: 'Legacy',
    legacy: true,
  },
  { id: 'comic_books', name: 'Comic books', category: 'Legacy', legacy: true },
  { id: 'stamps_coins', name: 'Stamps / coins', category: 'Legacy', legacy: true },
  { id: 'art_collecting', name: 'Art', category: 'Legacy', legacy: true },
  { id: 'plants_collecting', name: 'Plants', category: 'Legacy', legacy: true },
  { id: 'gardening', name: 'Gardening', category: 'Legacy', legacy: true },
  { id: 'houseplants', name: 'Houseplants', category: 'Legacy', legacy: true },
  { id: 'interior_decorating', name: 'Interior decorating', category: 'Legacy', legacy: true },
  { id: 'cooking_for_others', name: 'Cooking for others', category: 'Legacy', legacy: true },
  { id: 'hosting_game_nights', name: 'Hosting game nights', category: 'Legacy', legacy: true },
  { id: 'organizing_minimalism', name: 'Organizing / minimalism', category: 'Legacy', legacy: true },
  { id: 'online_courses', name: 'Online courses', category: 'Legacy', legacy: true },
  { id: 'lectures_ted_talks', name: 'Lectures / TED talks', category: 'Legacy', legacy: true },
  { id: 'gym', name: 'Gym / strength training', category: 'Legacy', legacy: true },
  { id: 'team_sports', name: 'Team sports', category: 'Legacy', legacy: true },
  { id: 'music', name: 'Music', category: 'Legacy', legacy: true },
  { id: 'visual_arts', name: 'Visual arts / design', category: 'Legacy', legacy: true },
  { id: 'writing', name: 'Writing', category: 'Legacy', legacy: true },
  { id: 'travel', name: 'Travel', category: 'Legacy', legacy: true },
  { id: 'gaming', name: 'Gaming', category: 'Legacy', legacy: true },
  { id: 'movies_tv', name: 'Movies / TV', category: 'Legacy', legacy: true },
  { id: 'nightlife', name: 'Nightlife / social events', category: 'Legacy', legacy: true },
  { id: 'entrepreneurship', name: 'Entrepreneurship / building', category: 'Legacy', legacy: true },
  { id: 'learning', name: 'Learning / courses', category: 'Legacy', legacy: true },
  { id: 'spirituality', name: 'Spirituality / religion', category: 'Legacy', legacy: true },
  { id: 'parenting', name: 'Parenting / family time', category: 'Legacy', legacy: true },
];

/** Maps retired picker ids to their closest current equivalent when re-saving. */
export const LEGACY_HOBBY_ID_ALIASES: Record<string, string> = {
  gym: 'weightlifting',
  crossfit: 'weightlifting',
  spin_classes: 'cycling',
  hiit_training: 'weightlifting',
  barre: 'pilates',
  calisthenics: 'weightlifting',
  triathlon_training: 'running',
  powerlifting: 'weightlifting',
  team_sports: 'running',
  backpacking: 'backpacking_abroad',
  trail_running: 'running',
  bird_watching: 'wildlife_photography',
  foraging: 'hiking',
  van_life_road_trips: 'camping',
  skydiving: 'rock_climbing',
  off_roading: 'mountain_biking',
  wine_tasting: 'wine_spirits_tasting',
  whiskey_spirits_tasting: 'wine_spirits_tasting',
  food_truck_hunting: 'trying_new_restaurants_food_tourism',
  trying_new_restaurants: 'trying_new_restaurants_food_tourism',
  food_tourism: 'trying_new_restaurants_food_tourism',
  fermenting: 'fermenting_cheese_making',
  cheese_making: 'fermenting_cheese_making',
  gardening_for_food: 'gardening_houseplants',
  painting: 'painting_drawing',
  drawing_sketching: 'painting_drawing',
  visual_arts: 'painting_drawing',
  sculpture: 'pottery_ceramics',
  graphic_design: 'digital_art',
  calligraphy: 'painting_drawing',
  film_photography: 'photography',
  knitting_crochet: 'knitting_crochet_embroidery',
  embroidery: 'knitting_crochet_embroidery',
  candle_making: 'pottery_ceramics',
  tattoo_art: 'digital_art',
  gardening: 'gardening_houseplants',
  houseplants: 'gardening_houseplants',
  interior_decorating: 'interior_design',
  music: 'playing_instrument',
  djing: 'djing_producing_music',
  producing_music: 'djing_producing_music',
  going_to_concerts: 'concerts_music_festivals',
  music_festivals: 'concerts_music_festivals',
  choir_a_cappella: 'singing',
  live_music_discovery: 'concerts_music_festivals',
  vinyl_records: 'vinyl_record_collecting',
  reading_fiction: 'reading',
  reading_nonfiction: 'reading',
  writing: 'creative_writing',
  blogging: 'creative_writing',
  screenwriting: 'creative_writing',
  language_learning_reading: 'reading',
  jigsaw_puzzles: 'board_games',
  fantasy_sports: 'trivia_nights',
  crosswords_word_games: 'trivia_nights',
  gaming: 'video_games',
  movie_nights: 'movie_nights_tv',
  movies_tv: 'movie_nights_tv',
  tv_show_marathons: 'movie_nights_tv',
  film_festivals: 'movie_nights_tv',
  stand_up_comedy: 'stand_up_comedy_theater',
  theater_musicals: 'stand_up_comedy_theater',
  true_crime: 'true_crime_documentaries',
  documentaries: 'true_crime_documentaries',
  reality_tv: 'movie_nights_tv',
  robotics: 'robotics_electronics',
  building_pcs: 'building_pcs_gaming_rigs',
  app_development: 'coding_side_projects',
  electronics_circuit_building: 'robotics_electronics',
  car_restoration_detailing: 'car_motorcycle_maintenance',
  motorcycle_maintenance: 'car_motorcycle_maintenance',
  journaling_reflection: 'journaling',
  travel: 'international_solo_travel',
  international_travel: 'international_solo_travel',
  solo_travel: 'international_solo_travel',
  museum_going: 'museums_historical_sites',
  historical_sites: 'museums_historical_sites',
  volunteering_abroad: 'volunteering',
  learning_local_cuisines: 'cooking',
  hosting_dinner_parties: 'hosting_dinner_parties_game_nights',
  hosting_game_nights: 'hosting_dinner_parties_game_nights',
  trivia_leagues: 'trivia_nights',
  rec_sports_leagues: 'running',
  improv_comedy_classes: 'public_speaking_improv',
  public_speaking_toastmasters: 'public_speaking_improv',
  comic_books: 'comics_graphic_novels',
  stamps_coins: 'antiques',
  art_collecting: 'antiques',
  plants_collecting: 'gardening_houseplants',
  cooking_for_others: 'cooking',
  organizing_minimalism: 'home_renovation_diy',
  learning: 'philosophy',
  online_courses: 'philosophy',
  lectures_ted_talks: 'philosophy',
  spirituality: 'faith_spiritual_community',
  entrepreneurship: 'coding_side_projects',
  nightlife: 'hosting_dinner_parties_game_nights',
};

const HOBBY_BY_ID = new Map(HOBBIES.map((h) => [h.id, h]));

export function normalizeHobbyId(id: string): string {
  const trimmed = String(id ?? '').trim();
  if (!trimmed) return trimmed;
  return LEGACY_HOBBY_ID_ALIASES[trimmed] ?? trimmed;
}

export function getHobbyById(id: string): Hobby | undefined {
  return HOBBY_BY_ID.get(id) ?? HOBBY_BY_ID.get(normalizeHobbyId(id));
}

export function getHobbiesByIds(ids: string[]): Hobby[] {
  return ids.map((id) => getHobbyById(id)).filter((h): h is Hobby => h != null);
}

export function getSelectableHobbies(): Hobby[] {
  return HOBBIES.filter((h) => !h.legacy);
}

export function getHobbiesByCategory(category: HobbyCategory): Hobby[] {
  return getSelectableHobbies().filter((h) => h.category === category);
}

export function isValidHobbySelectionCount(count: number): boolean {
  return count >= MIN_HOBBY_SELECTIONS && count <= MAX_HOBBY_SELECTIONS;
}
