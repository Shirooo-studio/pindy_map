class CreateFollows < ActiveRecord::Migration[7.2]
  def change
    create_table :follows do |t|
      t.bigint :follower_id, null: false
      t.bigint :followed_id, null: false
      t.timestamps
    end

    # 外部キー（users テーブルに向ける）
    add_foreign_key :follows, :users, column: :follower_id
    add_foreign_key :follows, :users, column: :followed_id

    # 同じ組み合わせを重複させない
    add_index :follows, [ :follower_id, :followed_id ], unique: true

    # 逆向き検索のための補助インデックス（任意）
    add_index :follows, :followed_id
  end
end
