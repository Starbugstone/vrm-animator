## TODO

- Plug frontend with backend and create login / registration pages
- pull custom avatars and animations from user profile
- allow creation of backstory, memory, name and backgrounds to each user avantar
- allow multiple avatars to be created and stored in the backend per user, add roles so that the option can become a payed tier at a later date.
- user data must be protected and never accessible by another user.
- An admin inteface for administrating and viewing the user's data, the user avatars, the user memory and the user historys.

## TODO: LLM

- add OpenRouter API Key to the backend to allow for LLM integration + model selection.
- add minimax authorization to the backend to allow for LLM integration.
- add glm authorization to the backend to allow for LLM integration.

- Add voice to text and speech to text functionality for a fluid vocal interaction between the user and the avatar (analyse and pricing needed).

## TODO: VRMA

- Add per-user custom animation storage and metadata in the backend.
- Persist each user's selected default idle clip and also extra animations with the context description instead of relying on local bundled `idle_main.vrma` and other local animaitions.
- Add authored transition rules for edge cases that should route through a bridge idle.
- Preload frequently used VRMA clips to remove first-play load latency.
- Add tests around idle-to-idle, idle-to-action, and action-to-idle crossfades.
