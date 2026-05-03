# Australia East AI Region Cutover

Round 4 AI services now prefer Australia East when the AU-specific environment variables are present.

## Active configuration

The Azure OpenAI wrapper selects Australia East when `AZURE_OPENAI_AU_ENDPOINT` is set. It then reads:

- `AZURE_OPENAI_AU_ENDPOINT`
- `AZURE_OPENAI_AU_KEY`
- `AZURE_OPENAI_AU_DEPLOYMENT`
- `AZURE_OPENAI_AU_API_VERSION`

The Azure Speech wrapper selects Australia East when `AZURE_SPEECH_AU_ENDPOINT` is set. It then reads:

- `AZURE_SPEECH_AU_ENDPOINT`
- `AZURE_SPEECH_AU_KEY`
- `AZURE_SPEECH_AU_REGION`

Both wrappers log their selected region at module load.

## Rollback

For one deploy cycle, the old eastus variables remain available as rollback safety. To roll back in Vercel, blank out or delete `AZURE_OPENAI_AU_ENDPOINT` and `AZURE_SPEECH_AU_ENDPOINT`, then redeploy. The wrappers will fall back to the existing `AZURE_OPENAI_*` and `AZURE_SPEECH_*` values.

## Cleanup

After about one week of stable Australia East operation:

1. Remove the eastus `AZURE_OPENAI_*` and `AZURE_SPEECH_*` variables from Vercel.
2. Remove the fallback branches from `src/lib/azureOpenAI.ts` and `src/lib/azureSpeech.ts`.
3. Keep only the Australia East variable names as the supported production configuration.
