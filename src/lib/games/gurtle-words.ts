/**
 * Gurtle's dictionary: four-letter English words, lower case, space separated.
 *
 * COMMON is everyday vocabulary. Daily and practice start words, par and the
 * hints only ever use these, so the route Gurtle shows is one anyone could find.
 * EXTRA is real but less everyday: a move may land on it (and can beat par that
 * way), but it never appears in a hint. Slurs, swearing and anything crude are
 * left out of both on purpose, since a hint or a share card could show them.
 *
 * The target, gurt, is not in either list; the engine adds it.
 */

export const COMMON_WORDS = `
able ache acid acne acre acts aged ages aide aids aims airs airy ajar akin also alto amid amps anew ante ants
apes apex aqua arch area aria arid arms army arts ashy asks atom atop aunt aura auto avid away awed axes axis
axle
babe baby back bade bags bail bait bake bald bale ball balm band bang bank bans barb bard bare bark barn bars
base bash bask bass bath bats bead beak beam bean bear beat beds beef been beep beer bees beet begs bell belt
bend bent best beta bets bias bibs bide bike bile bill bind bins bird bite bits blab bled blew blip blob blog
blot blow blue blur boar boat bode body boil bold bolt bomb bond bone bony book boom boon boot bore born boss
both bout bowl bows boys brag bran brat brew brim brow buck buds buff bugs bulb bulk bull bump bunk buns buoy
burn burp bury bush bust busy buys buzz byte
cabs cafe cage cake calf call calm came camp cane cans cape caps card care carp cars cart case cash cask cast
cats cave cell cent chap chat chef chew chin chip chop chow cite city clad clam clan clap claw clay clip clog
clot club clue coal coat coax code coil coin cola cold colt comb come cone cook cool coop cope copy cord core
cork corn cost cosy cots coup cove cows cozy crab crew crib crop crow cube cubs cued cues cuff cult cups curb
curd cure curl curt cute cuts
dabs dads daft dame damp dams dare dark darn dart dash data date dawn days daze dead deaf deal dean dear debt
deck deed deem deep deer defy deli demo dens dent deny desk dial dice died dies diet digs dime dine dips dire
dirt disc dish disk dive dock does dogs dole doll dome done doom door dose dote dots dove down doze drab drag
draw drew drip drop drug drum dual duck duct dude duel dues duet duke dull duly dumb dump dune dunk dusk dust
duty dyed dyes
each earl earn ears ease east easy eats echo edge edgy edit eggs egos else emit ends envy epic even ever eves
evil exam exit eyed eyes
face fact fade fads fail fair fake fall fame fang fans fare farm fast fate fawn fear feat feed feel fees feet
fell felt fend fern feud figs file fill film find fine fins fire firm fish fist fits five fizz flag flap flat
flaw flea fled flee flew flex flip flit flop flow flux foal foam foes fogs foil fold folk fond font food fool
foot ford fore fork form fort foul four fowl foxy fray free fret frog from fuel full fume fund funk furs fury
fuse fuss
gags gain gait gala gale game gang gape gaps garb gash gasp gate gave gawk gaze gear geek gels gems gene gent
germ gets gift gigs gild gill gilt girl gist give glad glee glen glib glow glue glum glut gnat gnaw goad goal
goat gods goes gold golf gone gong good goof gory gosh gown grab gram gray grew grey grid grim grin grip grit
grow grub gulf gull gulp gums gunk guns guru gush gust guts guys gyms
hack hail hair half hall halo halt hams hand hang hard hare harm harp hash hate hats haul have hawk haze hazy
head heal heap hear heat heck heed heel heir held helm help hems hens herb herd here hero hers hide high hike
hill hilt hind hint hips hire hiss hits hive hoax hogs hold hole holy home hone honk hood hoof hook hoop hoot
hope hops horn hose host hour howl hubs hues huff huge hugs hula hulk hull hump hums hung hunk hunt hurl hurt
hush husk huts hymn hype
iced ices icon idea idle idly idol inch info inks inky inns into ions iris iron isle itch item
jabs jack jade jail jams jars jaws jazz jean jeep jeer jerk jest jets jigs jinx jobs jogs join joke jolt jots
joys judo jugs jump junk jury just
keel keen keep kegs kelp kept keys kick kids kill kiln kilt kind king kink kiss kite kits kiwi knee knew knit
knob knot know
labs lace lack lacy lads lady laid lair lake lamb lame lamp land lane laps lard lark lash last late lava lawn
laws lays laze lazy lead leaf leak lean leap left legs lend lens lent less lest liar lice lick lids lied lies
life lift like lily limb lime limp line link lint lion lips lisp list live load loaf loan lobe lock loft logo
logs lone long look loom loon loop loot lord lore lose loss lost lots loud love lows luck lull lump lung lure
lurk lush lute
mace made maid mail main make male mall malt mama mane many maps mare mark mart mash mask mass mast mate math
mats maze meal mean meat meek meet meld melt memo mend menu meow mere mesh mess mice mild mile milk mill mime
mind mine mint mire miss mist mite mitt moan moat mobs mock mode mold mole molt monk mood moon moor moot mope
mops more moss most moth move mows much muck mugs mule mull murk muse mush musk must mute mutt myth
nags nail name nape naps navy near neat neck need neon nerd nest nets news newt next nibs nice nick nine nips
node nods none nook noon nope norm nose nosy note noun nuke null numb nuts
oaks oars oath oats obey oboe odds odor ogre oils oily okay omen omit once ones only onto onus ooze opal open
opts opus oral orbs ores ours oust outs oval oven over owed owes owls owns
pace pack pact pads page paid pail pain pair pale palm pals pane pang pans pant papa pare park part pass past
path pats pave pawn paws pays peak peal pear peas peat peck peek peel peep peer pegs pelt pens perk perm pert
pest pets pews pick pier pies pigs pike pile pill pine ping pink pins pint pipe pits pity plan play plea plod
plop plot plow ploy plug plum plus pods poem poet poke poky pole poll polo pomp pond pony pool poor pops pore
pork port pose posh post posy pots pour pout pram pray prep prey prim prod prom prop pros prow puck puff pull
pulp puma pump punk puns punt puny pups pure purr push puts putt
quad quay quip quit quiz
race rack racy raft rage rags raid rail rain rake ramp rams rang rank rant rare rash rasp rate rats rave rays
raze read real reap rear redo reed reef reek reel rely rent rest ribs rice rich ride rife rift rigs rims rind
ring rink riot ripe rips rise risk rite road roam roar robe robs rock rode rods role roll romp roof rook room
root rope rose rosy rots rout rove rows rubs ruby rude rugs ruin rule rump rune rung runs runt ruse rush rust
ruts
sack safe saga sage said sail sake sale salt same sand sane sang sank saps sash save saws says scab scam scan
scar seal seam sear seas seat sect seed seek seem seen seep seer sees self sell semi send sent sets sewn sews
shed shin ship shoe shoo shop shot show shun shut sick side sift sigh sign silk sill silo silt sing sink sins
sips sire site sits size skew skid skim skin skip skis slab slam slap slat slaw sled slew slid slim slip slit
slob slog slop slot slow slug slum slur smog snag snap snip snob snow snub snug soak soap soar sobs sock soda
sofa soft soil sold sole solo some song sons soon soot sore sort soul soup sour sown sows span spar spat sped
spin spit spot spry spud spun spur stab stag star stay stem step stew stir stop stow stub stud stun such suds
sued sues suit sulk sumo sums sung sunk suns sure surf swab swag swam swan swap swat sway swim
tabs tack taco tact tags tail take tale talk tall tame tang tank tans tape taps tarp tart task taut taxi teak
teal team tear teas tech teen tell tend tens tent term tern test text than that thaw them then they thin this
thud thug thus tick tide tidy tied tier ties tile till tilt time tins tint tiny tips tire toad toes tofu toga
toil told toll tomb tome tone tong tons took tool toot tops tore torn toss tote tots tour tout town tows toys
tram trap tray tree trek trim trio trip trod trot true tsar tuba tube tubs tuck tuft tugs tuna tune turf turn
tusk twig twin twos type typo
ugly undo unit unto upon urge urns used user uses
vain vale vane vans vary vase vast vats veal veer veil vein vent verb very vest veto vets vial vibe vice view
vile vine visa void volt vote vows
wade waft wage wags wail wait wake walk wall wand wane want ward ware warm warn warp wars wart wary wash wasp
watt wave wavy waxy ways weak wear webs weds weed week weep weld well welt went wept were west wets what when
whim whip whiz whom wick wide wife wigs wild will wilt wily wimp wind wine wing wink wins wipe wire wiry wise
wish wisp with wits woes woke wolf womb wont wood woof wool word wore work worm worn wove wrap wren writ
yaks yams yank yard yarn yawn yeah year yell yelp yeti yoga yoke yolk your yowl yuck yurt
zany zaps zeal zero zest zinc zing zips zone zoom zoos
`

export const EXTRA_WORDS = `
abet abut aced aces acme adze aeon afar agar agog ague ahem ahoy ails alas ales alms aloe alum amok anon apse
arcs arks auks avow awls awry axed ayes
baas bawl bays bevy bier bios bloc bobs bogs bola bole boll bonk boor bops bozo brad brie brig brut burg burl
burr byre
cads cagy cams carb caws cede chai char chum clod clop cloy coda cods coed cogs coke coma coos cowl crag cyst
czar
dais dank daub deft dell dhow diva dodo doff dolt dons dorm dory doth dour drat dray dreg drub dubs duff dung
dyer
ebbs eddy eels emus eons ergo etch euro ewer ewes expo
fats faux fava faze feta fiat fife firs flak flog flue fobs fops furl fuzz
gads gaff gaga gals gawp gibe gird girt glop gnus goby gore gout gurn gyre gyro
haft hags haha hale hark hasp haws heft hews hied hies hobo hods hove
ibex ibis iffy imps isms
jamb jape jibe jibs jinn jive jock joey jowl jute
kale keno kepi khan kith kohl kook
lade lags lain lama lank lath leek leer lees leis lido lien lieu lilt limo lire loam lobs lode loin loll lope
lops lout lube luge lugs lynx lyre
magi mags maim mako maws mead meds mega mesa mete mewl mews mica midi mien miff mink minx mods mojo moll moos
mown muff muss
nabs nana narc nary nave nays neap nigh noir nosh nubs
oafs oaky ogle okra onyx oops oozy orca orzo ouch ouzo ovum oxen
pall pawl pecs peso phew pied pith pleb pogo pong pooh poop pope prig psst puce puke pupa purl pyre
quid
raga raja rand rapt ream rein rend revs rhea rile rime roan roes rood rote roux rube rued rues ruff rums rusk
sago sags sari sate scow scud scum serf shah sham shim shiv shod sine skua slag sloe smug snit soba sods soya
spam spas spay spec spew stet stoa stye suck suet sump swig
tamp tare taro tarn tars teem tees thee thou tiff tiki tine tipi toed tosh tush tutu twee tyke tyre
udon ulna updo urea uvea
vamp vend vied vies viol vole
wadi wads waif wain wale wean weft weir wham whet whey whir whit whoa wino woad wonk woos wort wows
yack yaps yawl yawp yeas yens yews yogi yore yuan yule
zags zeta zigs zits zonk
`
