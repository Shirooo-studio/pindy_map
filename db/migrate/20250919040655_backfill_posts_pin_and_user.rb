class BackfillPostsPinAndUser < ActiveRecord::Migration[7.2]
  def up
    # まずは不足カラムを用意（順序が前後しても耐える）
    unless column_exists?(:posts, :pin_id)
      add_reference :posts, :pin, foreign_key: true, index: true, null: true
    end

    # user_id もこのBackfillで使うなら、同様に保険をかける（任意）
    # unless column_exists?(:posts, :user_id)
    #   add_reference :posts, :user, foreign_key: true, index: true, null: true
    # end

    # pins と posts の place_id/ google_place_id を突合して pin_id を埋める
    # （pins 側で google_place_id がユニークでない可能性もあるので DISTINCT ON + created_at ASC）
    execute <<~SQL.squish
      UPDATE posts p
      SET pin_id = sub.id
      FROM (
        SELECT DISTINCT ON (google_place_id) id, google_place_id
        FROM pins
        ORDER BY google_place_id, created_at ASC
      ) sub
      WHERE p.pin_id IS NULL
        AND p.place_id IS NOT NULL
        AND p.place_id = sub.google_place_id;
    SQL

    # ここで NOT NULL 制約を付けたい場合は、データ移行が終わってからにする
    # 例）change_column_null :posts, :pin_id, false
  end

  def down
    # downでは pin_id を落とすかは運用次第。安全のため残すなら何もしない。
    # remove_reference :posts, :pin, foreign_key: true if column_exists?(:posts, :pin_id)
  end
end
