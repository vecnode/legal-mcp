async def get_chatmodels():
    from openai import AsyncOpenAI as ModelClient
    client = ModelClient()  # uses environment variable API key
    starts_with = ["gpt", "ft:gpt", "o"]
    blacklist = ["instruct", "omni", "realtime", "audio", "search"]
    model_response = await client.models.list()
    model_dict = model_response.model_dump().get('data', [])
    model_list = sorted([model['id'] for model in model_dict])
    filtered_models = [
        model for model in model_list
        if any(model.startswith(prefix) for prefix in starts_with)
        and not any(bl_item in model for bl_item in blacklist)
    ]    
    return filtered_models

async def main():
    try:
        chat_model_list = await get_chatmodels()
        print("--------\n" + "\n".join(chat_model_list))
    except Exception as err:
        print("An error occurred:", err)

if __name__ == "__main__":
    asyncio.run(main())