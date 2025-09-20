class AddFieldsToPosts < ActiveRecord::Migration[7.2]
  def change
    # 既存データ配慮のため一旦 null: true
    add_reference :posts, :user, foreign_key: true, null: true

    # 投稿→ピンの紐付け（こちらも一旦 null: true）
    add_reference :posts, :pin,  foreign_key: true, null: true

    add_column :posts, :body, :text

    # pins と合わせて「会社内公開=1」をデフォルトに
    add_column :posts, :visibility, :integer, default: 1, null: false

    # 取得最適化（任意）
    add_index :posts, [:pin_id, :created_at]
    add_index :posts, :user_id
  end
end
