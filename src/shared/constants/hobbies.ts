export type Hobby = {
  id: string;
  name: string;
  category: string;
  /** Hidden from picker; kept so stored profile ids still resolve. */
  legacy?: boolean;
};

export const HOBBY_DEFINITION =
  'A hobby is defined by an activity you do just for the thrill of it, because it lights you up in some way. For example, if you cook a lot, but you only do it for practical reasons (save money / time, etc.) then that is not a hobby.';

export const MIN_HOBBY_SELECTIONS = 2;
export const MAX_HOBBY_SELECTIONS = 5;

export const HOBBY_CATEGORIES = [
  'Fitness & Movement',
  'Outdoors & Adventure',
  'Food & Drink',
  'Arts & Creativity',
  'Music',
  'Reading & Writing',
  'Games & Puzzles',
  'Film, TV & Pop Culture',
  'Tech & Making',
  'Wellness & Mindfulness',
  'Travel & Culture',
  'Social & Community',
  'Collecting',
  'Home & Domestic',
  'Pets & Animals',
  'Learning & Intellectual',
] as const;

export type HobbyCategory = (typeof HOBBY_CATEGORIES)[number];

export const HOBBIES: Hobby[] = [
  // Fitness & Movement
  { id: 'running', name: 'Running', category: 'Fitness & Movement' },
  { id: 'weightlifting', name: 'Weightlifting', category: 'Fitness & Movement' },
  { id: 'yoga', name: 'Yoga', category: 'Fitness & Movement' },
  { id: 'pilates', name: 'Pilates', category: 'Fitness & Movement' },
  { id: 'rock_climbing', name: 'Rock climbing', category: 'Fitness & Movement' },
  { id: 'crossfit', name: 'CrossFit', category: 'Fitness & Movement' },
  { id: 'cycling', name: 'Cycling', category: 'Fitness & Movement' },
  { id: 'swimming', name: 'Swimming', category: 'Fitness & Movement' },
  { id: 'boxing', name: 'Boxing', category: 'Fitness & Movement' },
  { id: 'martial_arts', name: 'Martial arts', category: 'Fitness & Movement' },
  { id: 'hiking', name: 'Hiking', category: 'Fitness & Movement' },
  { id: 'dance', name: 'Dance (any style)', category: 'Fitness & Movement' },
  { id: 'spin_classes', name: 'Spin classes', category: 'Fitness & Movement' },
  { id: 'hiit_training', name: 'HIIT training', category: 'Fitness & Movement' },
  { id: 'barre', name: 'Barre', category: 'Fitness & Movement' },
  { id: 'calisthenics', name: 'Calisthenics', category: 'Fitness & Movement' },
  { id: 'triathlon_training', name: 'Triathlon training', category: 'Fitness & Movement' },
  { id: 'powerlifting', name: 'Powerlifting', category: 'Fitness & Movement' },

  // Outdoors & Adventure
  { id: 'camping', name: 'Camping', category: 'Outdoors & Adventure' },
  { id: 'backpacking', name: 'Backpacking', category: 'Outdoors & Adventure' },
  { id: 'trail_running', name: 'Trail running', category: 'Outdoors & Adventure' },
  { id: 'fishing', name: 'Fishing', category: 'Outdoors & Adventure' },
  { id: 'hunting', name: 'Hunting', category: 'Outdoors & Adventure' },
  { id: 'kayaking', name: 'Kayaking', category: 'Outdoors & Adventure' },
  { id: 'surfing', name: 'Surfing', category: 'Outdoors & Adventure' },
  { id: 'skiing_snowboarding', name: 'Skiing / snowboarding', category: 'Outdoors & Adventure' },
  { id: 'mountain_biking', name: 'Mountain biking', category: 'Outdoors & Adventure' },
  { id: 'sailing', name: 'Sailing', category: 'Outdoors & Adventure' },
  { id: 'scuba_diving', name: 'Scuba diving', category: 'Outdoors & Adventure' },
  { id: 'bird_watching', name: 'Bird watching', category: 'Outdoors & Adventure' },
  { id: 'foraging', name: 'Foraging', category: 'Outdoors & Adventure' },
  { id: 'stargazing_astronomy', name: 'Stargazing / astronomy', category: 'Outdoors & Adventure' },
  { id: 'van_life_road_trips', name: 'Van life / road trips', category: 'Outdoors & Adventure' },
  { id: 'skydiving', name: 'Skydiving', category: 'Outdoors & Adventure' },
  { id: 'off_roading', name: 'Off-roading', category: 'Outdoors & Adventure' },

  // Food & Drink
  { id: 'cooking', name: 'Cooking', category: 'Food & Drink' },
  { id: 'baking', name: 'Baking', category: 'Food & Drink' },
  { id: 'wine_tasting', name: 'Wine tasting', category: 'Food & Drink' },
  { id: 'craft_beer_brewing', name: 'Craft beer / brewing', category: 'Food & Drink' },
  { id: 'coffee', name: 'Coffee (roasting, brewing, cafe-hopping)', category: 'Food & Drink' },
  { id: 'cocktail_mixology', name: 'Cocktail making / mixology', category: 'Food & Drink' },
  { id: 'grilling_barbecue', name: 'Grilling / barbecue', category: 'Food & Drink' },
  { id: 'food_truck_hunting', name: 'Food truck hunting', category: 'Food & Drink' },
  { id: 'trying_new_restaurants', name: 'Trying new restaurants', category: 'Food & Drink' },
  { id: 'fermenting', name: 'Fermenting (kombucha, kimchi, etc.)', category: 'Food & Drink' },
  { id: 'gardening_for_food', name: 'Gardening for food', category: 'Food & Drink' },
  { id: 'cheese_making', name: 'Cheese making', category: 'Food & Drink' },
  { id: 'whiskey_spirits_tasting', name: 'Whiskey / spirits tasting', category: 'Food & Drink' },

  // Arts & Creativity
  { id: 'painting', name: 'Painting', category: 'Arts & Creativity' },
  { id: 'drawing_sketching', name: 'Drawing / sketching', category: 'Arts & Creativity' },
  { id: 'photography', name: 'Photography', category: 'Arts & Creativity' },
  { id: 'pottery_ceramics', name: 'Pottery / ceramics', category: 'Arts & Creativity' },
  { id: 'sculpture', name: 'Sculpture', category: 'Arts & Creativity' },
  { id: 'graphic_design', name: 'Graphic design', category: 'Arts & Creativity' },
  { id: 'fashion_design_sewing', name: 'Fashion design / sewing', category: 'Arts & Creativity' },
  { id: 'calligraphy', name: 'Calligraphy', category: 'Arts & Creativity' },
  { id: 'woodworking', name: 'Woodworking', category: 'Arts & Creativity' },
  { id: 'jewelry_making', name: 'Jewelry making', category: 'Arts & Creativity' },
  { id: 'interior_design', name: 'Interior design', category: 'Arts & Creativity' },
  { id: 'film_photography', name: 'Film photography', category: 'Arts & Creativity' },
  { id: 'digital_art', name: 'Digital art', category: 'Arts & Creativity' },
  { id: 'knitting_crochet', name: 'Knitting / crochet', category: 'Arts & Creativity' },
  { id: 'embroidery', name: 'Embroidery', category: 'Arts & Creativity' },
  { id: 'candle_making', name: 'Candle making', category: 'Arts & Creativity' },
  {
    id: 'tattoo_art',
    name: 'Tattooing / tattoo art appreciation',
    category: 'Arts & Creativity',
  },

  // Music
  { id: 'playing_instrument', name: 'Playing an instrument', category: 'Music' },
  { id: 'singing', name: 'Singing', category: 'Music' },
  { id: 'djing', name: 'DJing', category: 'Music' },
  { id: 'producing_music', name: 'Producing music', category: 'Music' },
  { id: 'going_to_concerts', name: 'Going to concerts', category: 'Music' },
  { id: 'music_festivals', name: 'Music festivals', category: 'Music' },
  { id: 'karaoke', name: 'Karaoke', category: 'Music' },
  { id: 'songwriting', name: 'Songwriting', category: 'Music' },
  { id: 'choir_a_cappella', name: 'Choir / a cappella', category: 'Music' },
  { id: 'live_music_discovery', name: 'Live music discovery', category: 'Music' },

  // Reading & Writing
  { id: 'reading_fiction', name: 'Reading fiction', category: 'Reading & Writing' },
  { id: 'reading_nonfiction', name: 'Reading nonfiction', category: 'Reading & Writing' },
  { id: 'poetry', name: 'Poetry', category: 'Reading & Writing' },
  { id: 'journaling', name: 'Journaling', category: 'Reading & Writing' },
  { id: 'book_clubs', name: 'Book clubs', category: 'Reading & Writing' },
  { id: 'creative_writing', name: 'Creative writing', category: 'Reading & Writing' },
  { id: 'blogging', name: 'Blogging', category: 'Reading & Writing' },
  { id: 'screenwriting', name: 'Screenwriting', category: 'Reading & Writing' },
  { id: 'comics_graphic_novels', name: 'Comics / graphic novels', category: 'Reading & Writing' },
  { id: 'audiobooks', name: 'Audiobooks', category: 'Reading & Writing' },
  {
    id: 'language_learning_reading',
    name: 'Language learning through reading',
    category: 'Reading & Writing',
  },

  // Games & Puzzles
  { id: 'board_games', name: 'Board games', category: 'Games & Puzzles' },
  { id: 'video_games', name: 'Video games', category: 'Games & Puzzles' },
  { id: 'chess', name: 'Chess', category: 'Games & Puzzles' },
  { id: 'poker_card_games', name: 'Poker / card games', category: 'Games & Puzzles' },
  { id: 'trivia_nights', name: 'Trivia nights', category: 'Games & Puzzles' },
  { id: 'escape_rooms', name: 'Escape rooms', category: 'Games & Puzzles' },
  { id: 'jigsaw_puzzles', name: 'Puzzles (jigsaw)', category: 'Games & Puzzles' },
  { id: 'tabletop_rpg', name: 'Dungeons & Dragons / tabletop RPGs', category: 'Games & Puzzles' },
  { id: 'fantasy_sports', name: 'Fantasy sports', category: 'Games & Puzzles' },
  { id: 'crosswords_word_games', name: 'Crosswords / word games', category: 'Games & Puzzles' },

  // Film, TV & Pop Culture
  { id: 'movie_nights', name: 'Movie nights', category: 'Film, TV & Pop Culture' },
  { id: 'film_festivals', name: 'Film festivals', category: 'Film, TV & Pop Culture' },
  { id: 'tv_show_marathons', name: 'TV show marathons', category: 'Film, TV & Pop Culture' },
  { id: 'anime', name: 'Anime', category: 'Film, TV & Pop Culture' },
  { id: 'stand_up_comedy', name: 'Stand-up comedy', category: 'Film, TV & Pop Culture' },
  { id: 'theater_musicals', name: 'Theater / musicals', category: 'Film, TV & Pop Culture' },
  { id: 'podcasts', name: 'Podcasts', category: 'Film, TV & Pop Culture' },
  { id: 'true_crime', name: 'True crime', category: 'Film, TV & Pop Culture' },
  { id: 'documentaries', name: 'Documentaries', category: 'Film, TV & Pop Culture' },
  { id: 'reality_tv', name: 'Reality TV', category: 'Film, TV & Pop Culture' },

  // Tech & Making
  { id: 'coding_side_projects', name: 'Coding / side projects', category: 'Tech & Making' },
  { id: '3d_printing', name: '3D printing', category: 'Tech & Making' },
  { id: 'robotics', name: 'Robotics', category: 'Tech & Making' },
  { id: 'home_automation', name: 'Home automation / smart home tinkering', category: 'Tech & Making' },
  { id: 'building_pcs', name: 'Building PCs', category: 'Tech & Making' },
  { id: 'app_development', name: 'App development', category: 'Tech & Making' },
  { id: 'drone_flying', name: 'Drone flying', category: 'Tech & Making' },
  {
    id: 'electronics_circuit_building',
    name: 'Electronics / circuit building',
    category: 'Tech & Making',
  },
  { id: 'car_restoration_detailing', name: 'Car restoration / detailing', category: 'Tech & Making' },
  { id: 'motorcycle_maintenance', name: 'Motorcycle maintenance', category: 'Tech & Making' },

  // Wellness & Mindfulness
  { id: 'meditation', name: 'Meditation', category: 'Wellness & Mindfulness' },
  { id: 'breathwork', name: 'Breathwork', category: 'Wellness & Mindfulness' },
  {
    id: 'journaling_reflection',
    name: 'Journaling for reflection',
    category: 'Wellness & Mindfulness',
  },
  { id: 'sound_baths', name: 'Sound baths', category: 'Wellness & Mindfulness' },
  { id: 'cold_plunging', name: 'Cold plunging', category: 'Wellness & Mindfulness' },
  { id: 'sauna', name: 'Sauna', category: 'Wellness & Mindfulness' },
  { id: 'tarot_astrology', name: 'Tarot / astrology', category: 'Wellness & Mindfulness' },

  // Travel & Culture
  { id: 'international_travel', name: 'International travel', category: 'Travel & Culture' },
  { id: 'solo_travel', name: 'Solo travel', category: 'Travel & Culture' },
  { id: 'backpacking_abroad', name: 'Backpacking abroad', category: 'Travel & Culture' },
  { id: 'language_learning', name: 'Language learning', category: 'Travel & Culture' },
  { id: 'cultural_festivals', name: 'Cultural festivals', category: 'Travel & Culture' },
  { id: 'museum_going', name: 'Museum going', category: 'Travel & Culture' },
  { id: 'historical_sites', name: 'Historical sites', category: 'Travel & Culture' },
  { id: 'food_tourism', name: 'Food tourism', category: 'Travel & Culture' },
  { id: 'volunteering_abroad', name: 'Volunteering abroad', category: 'Travel & Culture' },
  { id: 'learning_local_cuisines', name: 'Learning local cuisines', category: 'Travel & Culture' },

  // Social & Community
  { id: 'volunteering', name: 'Volunteering', category: 'Social & Community' },
  { id: 'hosting_dinner_parties', name: 'Hosting dinner parties', category: 'Social & Community' },
  { id: 'trivia_leagues', name: 'Trivia leagues', category: 'Social & Community' },
  { id: 'community_organizing', name: 'Community organizing', category: 'Social & Community' },
  { id: 'mentoring', name: 'Mentoring', category: 'Social & Community' },
  {
    id: 'faith_spiritual_community',
    name: 'Faith / spiritual community',
    category: 'Social & Community',
  },
  { id: 'rec_sports_leagues', name: 'Sports leagues (rec sports)', category: 'Social & Community' },
  { id: 'improv_comedy_classes', name: 'Improv / comedy classes', category: 'Social & Community' },
  {
    id: 'public_speaking_toastmasters',
    name: 'Public speaking / Toastmasters',
    category: 'Social & Community',
  },

  // Collecting
  { id: 'vinyl_records', name: 'Vinyl records', category: 'Collecting' },
  { id: 'sneakers', name: 'Sneakers', category: 'Collecting' },
  { id: 'vintage_clothing', name: 'Vintage clothing', category: 'Collecting' },
  { id: 'comic_books', name: 'Comic books', category: 'Collecting' },
  { id: 'trading_cards', name: 'Trading cards', category: 'Collecting' },
  { id: 'antiques', name: 'Antiques', category: 'Collecting' },
  { id: 'stamps_coins', name: 'Stamps / coins', category: 'Collecting' },
  { id: 'art_collecting', name: 'Art', category: 'Collecting' },
  { id: 'watches', name: 'Watches', category: 'Collecting' },
  { id: 'plants_collecting', name: 'Plants', category: 'Collecting' },

  // Home & Domestic
  { id: 'gardening', name: 'Gardening', category: 'Home & Domestic' },
  { id: 'houseplants', name: 'Houseplants', category: 'Home & Domestic' },
  { id: 'home_renovation_diy', name: 'Home renovation / DIY', category: 'Home & Domestic' },
  { id: 'interior_decorating', name: 'Interior decorating', category: 'Home & Domestic' },
  { id: 'furniture_restoration', name: 'Furniture restoration', category: 'Home & Domestic' },
  { id: 'cooking_for_others', name: 'Cooking for others', category: 'Home & Domestic' },
  { id: 'hosting_game_nights', name: 'Hosting game nights', category: 'Home & Domestic' },
  { id: 'organizing_minimalism', name: 'Organizing / minimalism', category: 'Home & Domestic' },

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
  { id: 'economics_investing', name: 'Economics / investing', category: 'Learning & Intellectual' },
  {
    id: 'politics_current_events',
    name: 'Politics / current events',
    category: 'Learning & Intellectual',
  },
  { id: 'debate', name: 'Debate', category: 'Learning & Intellectual' },
  { id: 'online_courses', name: 'Online courses', category: 'Learning & Intellectual' },
  { id: 'lectures_ted_talks', name: 'Lectures / TED talks', category: 'Learning & Intellectual' },

  // Legacy ids (pre-expanded list) — still resolve for saved profiles
  { id: 'gym', name: 'Gym / strength training', category: 'Legacy', legacy: true },
  { id: 'team_sports', name: 'Team sports', category: 'Legacy', legacy: true },
  { id: 'music', name: 'Music', category: 'Legacy', legacy: true },
  { id: 'visual_arts', name: 'Visual arts / design', category: 'Legacy', legacy: true },
  { id: 'writing', name: 'Writing', category: 'Legacy', legacy: true },
  { id: 'travel', name: 'Travel', category: 'Legacy', legacy: true },
  { id: 'gaming', name: 'Gaming', category: 'Legacy', legacy: true },
  { id: 'reading', name: 'Reading', category: 'Legacy', legacy: true },
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
  team_sports: 'rec_sports_leagues',
  music: 'playing_instrument',
  visual_arts: 'painting',
  writing: 'creative_writing',
  travel: 'international_travel',
  gaming: 'video_games',
  reading: 'reading_fiction',
  movies_tv: 'movie_nights',
  learning: 'online_courses',
  spirituality: 'faith_spiritual_community',
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
