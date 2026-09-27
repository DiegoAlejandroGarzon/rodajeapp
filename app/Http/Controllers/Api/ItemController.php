<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ItemResource;
use App\Models\Item;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class ItemController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $items = Item::query()
            ->with('category')
            ->when($request->string('search')->toString(), function ($query, string $search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('serial', 'like', "%{$search}%");
                });
            })
            ->when($request->input('category_id'), fn ($query, $id) => $query->where('category_id', $id))
            ->when($request->input('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->boolean('needs_review'), fn ($query) => $query->where('needs_review', true))
            ->orderBy('name')
            ->paginate($request->integer('per_page', 50));

        return ItemResource::collection($items);
    }

    public function show(Item $item): ItemResource
    {
        return ItemResource::make($item->load('category'));
    }

    public function store(Request $request): ItemResource
    {
        $data = $request->validate($this->rules());

        return ItemResource::make(Item::create($data)->load('category'));
    }

    public function update(Request $request, Item $item): ItemResource
    {
        $data = $request->validate($this->rules($item));

        $item->update($data);

        return ItemResource::make($item->load('category'));
    }

    /**
     * Confirma un equipo que se creó en locación sin conexión.
     */
    public function approve(Item $item): ItemResource
    {
        $item->update(['needs_review' => false]);

        return ItemResource::make($item->load('category'));
    }

    public function destroy(Item $item): JsonResponse
    {
        $item->delete();

        return response()->json(['message' => 'Equipo eliminado.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(?Item $item = null): array
    {
        return [
            'id' => ['sometimes', 'uuid'],
            'category_id' => ['nullable', 'uuid', 'exists:categories,id'],
            'name' => [$item ? 'sometimes' : 'required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255', Rule::unique('items', 'code')->ignore($item?->id)],
            'serial' => ['nullable', 'string', 'max:255'],
            'quantity' => ['sometimes', 'integer', 'min:0'],
            'reference_value' => ['nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', Rule::in([
                Item::STATUS_AVAILABLE,
                Item::STATUS_MAINTENANCE,
                Item::STATUS_LOST,
                Item::STATUS_RETIRED,
            ])],
            'notes' => ['nullable', 'string'],
        ];
    }
}
