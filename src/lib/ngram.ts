/**
 * N-gram based word prediction / autocomplete.
 * 
 * Uses a combination of:
 * 1. Prefix matching against a common English word dictionary
 * 2. Bigram frequency for contextual suggestions
 * 3. Word frequency ranking for relevance
 */

// Top ~2000 common English words (abbreviated for bundle size)
const COMMON_WORDS = [
  'the','be','to','of','and','a','in','that','have','i','it','for','not','on','with',
  'he','as','you','do','at','this','but','his','by','from','they','we','her','she','or',
  'an','will','my','one','all','would','there','their','what','so','up','out','if','about',
  'who','get','which','go','me','when','make','can','like','time','no','just','him','know',
  'take','people','into','year','your','good','some','could','them','see','other','than',
  'then','now','look','only','come','its','over','think','also','back','after','use','two',
  'how','our','work','first','well','way','even','new','want','because','any','these','give',
  'day','most','us','great','between','need','large','often','old','while','home','big',
  'high','school','small','place','every','under','keep','last','never','same','should',
  'still','world','start','city','run','own','say','help','much','before','move','right',
  'boy','did','end','where','let','long','too','does','must','may','been','many','more',
  'very','off','part','hand','food','here','each','tell','sure','ask','turn','point',
  'head','read','away','call','play','near','put','thing','close','found','live','name',
  'please','thank','hello','yes','word','write','left','open','next','love','life','find',
  'man','girl','again','house','change','went','water','light','tree','still','learn',
  'night','hard','eat','best','better','money','stop','try','side','might','line','walk',
  'few','car','talk','number','came','real','down','door','book','mother','father','eye',
  'house','morning','hand','together','enough','below','happy','hear','wait','stay',
  'sleep','thought','air','feel','meet','idea','young','window','face','nice','type',
  'computer','screen','message','keyboard','text','email','phone','camera','picture',
  'today','tomorrow','yesterday','morning','afternoon','evening','night',
  'monday','tuesday','wednesday','thursday','friday','saturday','sunday',
  'january','february','march','april','june','july','august','september',
  'october','november','december','spring','summer','autumn','winter',
  'color','music','song','game','movie','friend','family','brother','sister',
  'water','coffee','tea','breakfast','lunch','dinner','hungry','thirsty',
  'doctor','hospital','medicine','pain','sick','cold','warm','weather',
  'beautiful','wonderful','amazing','awesome','cool','interesting','important',
  'bathroom','bedroom','kitchen','outside','inside','garden','office','store',
  'sorry','thanks','bye','goodbye','welcome','congratulations',
];

// Common bigrams (word pairs) for contextual prediction
const BIGRAMS: Record<string, string[]> = {
  'i': ['am','want','need','like','have','think','will','can','would','love'],
  'you': ['are','can','will','have','want','need','should','could','would','may'],
  'the': ['best','first','last','next','same','new','old','most','other','right'],
  'is': ['a','the','not','very','so','it','that','this','my','your'],
  'it': ['is','was','will','can','has','would','could','should','may','might'],
  'to': ['be','do','get','go','have','make','see','the','say','know'],
  'in': ['the','a','my','this','that','our','his','her','your','it'],
  'and': ['i','the','a','it','he','she','they','we','this','that'],
  'that': ['is','was','the','i','you','it','he','she','we','they'],
  'have': ['a','to','been','the','you','no','not','any','it','some'],
  'what': ['is','are','do','did','was','about','if','would','can','time'],
  'how': ['are','do','is','did','much','many','long','about','can','to'],
  'my': ['name','family','friend','house','phone','email','work','life','own','way'],
  'thank': ['you','god','goodness'],
  'good': ['morning','afternoon','evening','night','day','job','luck','bye','idea','time'],
  'please': ['help','call','come','stop','wait','tell','send','give','open','close'],
  'can': ['you','i','we','they','not','help','see','do','be','get'],
  'do': ['you','not','it','we','they','this','that','the'],
  'will': ['be','you','have','do','not','the','come','get','go','see'],
};

/**
 * Get word predictions based on current input.
 * 
 * @param currentWord - The word fragment being typed
 * @param previousWord - The previous completed word (for bigram context)
 * @param maxSuggestions - Maximum number of suggestions to return
 * @returns Array of predicted words
 */
export function getPredictions(
  currentWord: string,
  previousWord = '',
  maxSuggestions = 3
): string[] {
  if (!currentWord && !previousWord) return [];

  const prefix = currentWord.toLowerCase();
  const prev = previousWord.toLowerCase();

  // If we have a prefix, filter by it
  let candidates: string[];

  if (prefix.length > 0) {
    // Prefix match
    candidates = COMMON_WORDS.filter(
      (w) => w.startsWith(prefix) && w !== prefix
    );

    // Boost words that appear in bigrams of previous word
    if (prev && BIGRAMS[prev]) {
      const bigramWords = new Set(BIGRAMS[prev]);
      candidates.sort((a, b) => {
        const aInBigram = bigramWords.has(a) ? 0 : 1;
        const bInBigram = bigramWords.has(b) ? 0 : 1;
        return aInBigram - bInBigram;
      });
    }
  } else if (prev) {
    // No prefix yet, suggest based on previous word (bigram)
    candidates = BIGRAMS[prev] || [];
  } else {
    return [];
  }

  return candidates.slice(0, maxSuggestions);
}

/**
 * Extract the current word being typed and the previous word.
 */
export function extractCurrentAndPrevWord(text: string): {
  currentWord: string;
  previousWord: string;
} {
  const trimmed = text.trimEnd();
  const words = trimmed.split(/\s+/);

  if (text.endsWith(' ')) {
    // Just finished a word, start fresh
    return {
      currentWord: '',
      previousWord: words[words.length - 1] || '',
    };
  }

  return {
    currentWord: words[words.length - 1] || '',
    previousWord: words[words.length - 2] || '',
  };
}
