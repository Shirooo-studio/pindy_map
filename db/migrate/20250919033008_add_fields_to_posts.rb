class AddFieldsToPosts < ActiveRecord::Migration[7.2]
  def up
    # すでに存在する場合は追加しない
    add_reference :posts, :user, foreign_key: true, null: true unless column_exists?(:posts, :user_id)
    add_reference :posts, :pin,  foreign_key: true, null: true unless column_exists?(:posts, :pin_id)

    add_column :posts, :body, :text unless column_exists?(:posts, :body)

    # pins と合わせて「会社内公開=1」をデフォルト
    unless column_exists?(:posts, :visibility)
      add_column :posts, :visibility, :integer, default: 1, null: false
    end

    # 取得最適化（既存なら作らない）
    add_index :posts, [ :pin_id, :created_at ] unless index_exists?(:posts, [ :pin_id, :created_at ])
    add_index :posts, :user_id                unless index_exists?(:posts, :user_id)
  end

  def down
    # ロールバック時のみ実行される想定。存在時だけ削除
    remove_index  :posts, column: [ :pin_id, :created_at ] if index_exists?(:posts, [ :pin_id, :created_at ])
    remove_index  :posts, column: :user_id                if index_exists?(:posts, :user_id)

    remove_column :posts, :visibility if column_exists?(:posts, :visibility)
    remove_column :posts, :body       if column_exists?(:posts, :body)

    # 参照は存在時のみ削除（本来このマイグレーションで追加した場合のみ）
    remove_reference :posts, :pin,  foreign_key: true if column_exists?(:posts, :pin_id)
    remove_reference :posts, :user, foreign_key: true if column_exists?(:posts, :user_id)
  end
end
