# CinePair UI direction

## Product feel

CinePair should feel like a quiet shared cinema. The film and the people in the room get the most space. The controls stay visible when needed, with one clear primary action per screen. Couples can start with no account; room options and account settings remain available without crowding the main view.

## Palette

| Role | Dark mode | Light mode | Use |
| --- | --- | --- | --- |
| Background | `#131615` | `#F4F1EA` | App canvas |
| Surface | `#1C1E1D` | `#FFFDFA` | Panels and dialogs |
| Text | `#F6F2EA` | `#242521` | Primary copy |
| Line | `#383D3A` | `#DEDBD3` | Subtle boundaries |
| Coral | `#F08070` | `#B94136` | Primary actions and focus |

Coral gives the app warmth and a recognisable action color without making every control compete with the movie. Dark mode is the default for watching; light mode uses warm neutrals for daytime use. Fraunces gives headings a cinema feel, while DM Sans keeps controls legible.

## Screen hierarchy

1. **Welcome:** one sentence of purpose, then two explicit actions: create and join.
2. **Setup:** one form surface, visible step progress, readable labels, and large inputs.
3. **Room:** shared video and participants first; Watch, Invite, and Chat in the header; less frequent actions in More; call controls in a persistent dock.
4. **Watch:** large player, one link field, a service selector, an optional YouTube ID input, and the queue.
5. **Settings:** short tab names, grouped preferences, and pixel avatar choices.
6. **Public site:** the same warm typography and coral action color, with room-service availability stated explicitly.

The layout compresses at narrow widths. Chat becomes a full-width overlay with its own close control. The room keeps the same core actions accessible on small screens.

## Inspiration and boundaries

- [Keet](https://snapcraft.io/keet): video as the main surface with compact call actions.
- [Fin](https://fincinema.app/): calm editorial typography and breathing room around cinema content.
- [CineStream concept on Dribbble](https://dribbble.com/shots/26945488-CineStream-Premium-Movie-Exploration-Mobile-App): restrained dark cinema palette.

These are references for hierarchy and mood. CinePair's screens, copy, colors, and interactions are implemented for its own features. Streaming services still require each person's own access and may restrict capture or embedding.
